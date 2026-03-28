import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-line-signature",
};

async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const computed = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return computed === signature;
}

async function fetchLineImage(messageId: string, accessToken: string): Promise<Uint8Array> {
  const res = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`LINE Content API error: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function replyToLine(replyToken: string, messages: any[], accessToken: string) {
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const channelSecret = Deno.env.get("LINE_CHANNEL_SECRET");
  const accessToken = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
  if (!channelSecret || !accessToken) {
    return new Response(JSON.stringify({ error: "LINE credentials not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const bodyText = await req.text();
    const signature = req.headers.get("x-line-signature") || "";

    if (!await verifySignature(bodyText, signature, channelSecret)) {
      return new Response("Invalid signature", { status: 403, headers: corsHeaders });
    }

    const body = JSON.parse(bodyText);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    for (const event of body.events || []) {
      // Idempotency check
      if (event.message?.id) {
        const { data: existing } = await supabase
          .from("processed_messages")
          .select("id")
          .eq("id", event.message.id)
          .limit(1);
        if (existing && existing.length > 0) continue;
        await supabase.from("processed_messages").insert({ id: event.message.id });
      }

      const lineUserId = event.source?.userId;
      const replyToken = event.replyToken;

      if (event.type === "message" && event.message?.type === "image") {
        try {
          // Fetch image from LINE
          const imageData = await fetchLineImage(event.message.id, accessToken);

          // Upload to storage
          const filePath = `line/${lineUserId}/${crypto.randomUUID()}.jpg`;
          await supabase.storage.from("slip-images").upload(filePath, imageData, {
            contentType: "image/jpeg",
          });

          // Compute hash
          const hashBuffer = await crypto.subtle.digest("SHA-256", imageData);
          const imageHash = Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, "0")).join("");

          // Duplicate check
          const { data: dupCheck } = await supabase
            .from("transactions")
            .select("id, amount, merchant_name")
            .eq("image_hash", imageHash)
            .limit(1);

          if (dupCheck && dupCheck.length > 0) {
            await replyToLine(replyToken, [{
              type: "text",
              text: `⚠️ สลิปนี้เคยบันทึกแล้ว\nรายการ: ${dupCheck[0].merchant_name || "N/A"}\nจำนวน: ${dupCheck[0].amount || "N/A"} บาท`,
            }], accessToken);
            continue;
          }

          // Call extract-slip logic inline (same Lovable AI)
          const base64 = btoa(String.fromCharCode(...imageData));
          const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;

          // Use the extract-slip function via internal call
          const extractRes = await fetch(`${supabaseUrl}/functions/v1/extract-slip`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              image: base64,
              mimeType: "image/jpeg",
              source: "line",
              lineUserId,
              lineMessageId: event.message.id,
            }),
          });

          const extractData = await extractRes.json();

          if (extractData.extraction_failed) {
            await replyToLine(replyToken, [{
              type: "text",
              text: `❌ ไม่สามารถอ่านสลิปได้\n${extractData.error_message || "กรุณาลองส่งรูปใหม่ที่ชัดขึ้น"}`,
            }], accessToken);
            continue;
          }

          // Update with LINE context
          if (extractData.transaction_id) {
            await supabase.from("transactions").update({
              line_user_id: lineUserId,
              line_message_id: event.message.id,
              source: "line",
            }).eq("id", extractData.transaction_id);
          }

          const ext = extractData.extraction;
          const summary = [
            `💰 ${ext.amount?.toLocaleString() || "?"} ${ext.currency || "THB"}`,
            ext.merchant_name ? `🏪 ${ext.merchant_name}` : null,
            ext.receiver_name ? `👤 ${ext.receiver_name}` : null,
            ext.bank_name ? `🏦 ${ext.bank_name}` : null,
            ext.date_display ? `📅 ${ext.date_display} ${ext.time_display || ""}` : null,
            ext.category_guess ? `📁 ${ext.category_guess}` : null,
            `\n✅ ยืนยัน | ✏️ แก้ไข | ❌ ข้าม`,
          ].filter(Boolean).join("\n");

          await replyToLine(replyToken, [
            { type: "text", text: `📋 สลิปใหม่\n\n${summary}` },
            {
              type: "template",
              altText: "ยืนยันรายการ",
              template: {
                type: "buttons",
                text: "ต้องการดำเนินการอย่างไร?",
                actions: [
                  { type: "postback", label: "✅ ยืนยัน", data: `action=confirm&id=${extractData.transaction_id}` },
                  { type: "postback", label: "❌ ข้าม", data: `action=ignore&id=${extractData.transaction_id}` },
                ],
              },
            },
          ], accessToken);
        } catch (imgErr: any) {
          console.error("Image processing error:", imgErr);
          await replyToLine(replyToken, [{
            type: "text",
            text: `❌ เกิดข้อผิดพลาด: ${imgErr.message || "ไม่สามารถประมวลผลได้"}`,
          }], accessToken);
        }
      } else if (event.type === "postback") {
        const params = new URLSearchParams(event.postback?.data || "");
        const action = params.get("action");
        const txId = params.get("id");

        if (txId && (action === "confirm" || action === "ignore")) {
          // Ownership validation: ensure this LINE user owns the transaction
          const { data: txCheck } = await supabase
            .from("transactions")
            .select("id, line_user_id, amount, merchant_name")
            .eq("id", txId)
            .single();

          if (!txCheck || (txCheck.line_user_id && txCheck.line_user_id !== lineUserId)) {
            await replyToLine(replyToken, [{
              type: "text", text: "⚠️ ไม่มีสิทธิ์ดำเนินการกับรายการนี้",
            }], accessToken);
            continue;
          }

          if (action === "confirm") {
            await supabase.from("transactions").update({
              status: "confirmed",
              category_final: (await supabase.from("transactions").select("category_guess").eq("id", txId).single()).data?.category_guess,
              sheets_sync_status: "pending",
              drive_sync_status: "pending",
            }).eq("id", txId);

            // Trigger async syncs (fire and forget)
            fetch(`${supabaseUrl}/functions/v1/sync-sheets`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
              body: JSON.stringify({ transaction_id: txId }),
            }).catch(e => console.error("sync-sheets trigger error:", e));

            fetch(`${supabaseUrl}/functions/v1/sync-drive`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
              body: JSON.stringify({ transaction_id: txId }),
            }).catch(e => console.error("sync-drive trigger error:", e));

            await replyToLine(replyToken, [{
              type: "text",
              text: `✅ ยืนยันแล้ว\n${txCheck.merchant_name || ""} ${txCheck.amount?.toLocaleString() || ""} บาท`,
            }], accessToken);
          } else {
            await supabase.from("transactions").update({ status: "ignored" }).eq("id", txId);
            await replyToLine(replyToken, [{
              type: "text", text: "❌ ข้ามรายการแล้ว",
            }], accessToken);
          }
        }
      } else if (event.type === "message" && event.message?.type === "text") {
        const text = event.message.text.trim();

        if (text.includes("เดือนนี้") || text.includes("สรุป")) {
          const now = new Date();
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

          const { data: monthTxs } = await supabase
            .from("transactions")
            .select("amount, category_guess")
            .eq("status", "confirmed")
            .eq("line_user_id", lineUserId)
            .gte("created_at", startOfMonth);

          const total = (monthTxs || []).reduce((sum, t) => sum + (t.amount || 0), 0);
          const count = monthTxs?.length || 0;

          const monthName = now.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
          await replyToLine(replyToken, [{
            type: "text",
            text: `📊 สรุปเดือน${monthName}\n\n💰 รวม: ${total.toLocaleString()} บาท\n📝 ${count} รายการ`,
          }], accessToken);
        } else {
          await replyToLine(replyToken, [{
            type: "text",
            text: "📸 ส่งรูปสลิปมาเพื่อบันทึกรายจ่าย\n📊 พิมพ์ 'สรุปเดือนนี้' เพื่อดูสรุป",
          }], accessToken);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("line-webhook error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
