import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function verifyLineIdToken(idToken: string, liffChannelId: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id_token: idToken, client_id: liffChannelId }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.sub || null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, transactionId, idToken, updates } = await req.json();

    if (!action || !transactionId || !idToken) {
      return new Response(JSON.stringify({ error: "Missing action, transactionId, or idToken" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["confirm", "ignore", "update", "cancel"].includes(action)) {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const liffChannelId = Deno.env.get("LIFF_CHANNEL_ID") || "";
    const verifiedUserId = await verifyLineIdToken(idToken, liffChannelId);

    if (!verifiedUserId) {
      return new Response(JSON.stringify({ error: "Invalid LINE identity" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch and validate ownership
    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .select("id, line_user_id, status, category_guess")
      .eq("id", transactionId)
      .single();

    if (txErr || !tx) {
      return new Response(JSON.stringify({ error: "Transaction not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (tx.line_user_id !== verifiedUserId) {
      return new Response(JSON.stringify({ error: "ไม่มีสิทธิ์ดำเนินการกับรายการนี้" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Block actions on cancelled transactions
    if (tx.status === "cancelled") {
      return new Response(JSON.stringify({ 
        error: "รายการนี้ถูกยกเลิกแล้ว",
        already_finalized: true,
        status: tx.status,
      }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let updatePayload: Record<string, any> = {};

    if (action === "confirm") {
      updatePayload = {
        status: "confirmed",
        category_final: tx.category_guess,
        sheets_sync_status: "pending",
        drive_sync_status: "pending",
      };
    } else if (action === "ignore") {
      updatePayload = { status: "ignored" };
    } else if (action === "cancel") {
      updatePayload = { status: "cancelled" };
    } else if (action === "update") {
      // Whitelist allowed update fields — preserve current status
      const allowed = ["amount", "merchant_name", "category_final", "date_display", "time_display", "notes", "transaction_type"];
      updatePayload = {};
      if (updates && typeof updates === "object") {
        for (const key of allowed) {
          if (key in updates) updatePayload[key] = updates[key];
        }
      }
      // If still pending, confirm on save; otherwise keep current status
      if (tx.status === "pending_confirmation") {
        updatePayload.status = "confirmed";
        updatePayload.sheets_sync_status = "pending";
        updatePayload.drive_sync_status = "pending";
      }
    }

    const { data: updated, error: updateErr } = await supabase
      .from("transactions")
      .update(updatePayload)
      .eq("id", transactionId)
      .select()
      .single();

    if (updateErr) {
      console.error("liff-action update error:", updateErr);
      return new Response(JSON.stringify({ error: "Update failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Trigger syncs only for confirm or update-on-pending (fire and forget)
    if (action === "confirm" || (action === "update" && tx.status === "pending_confirmation")) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      fetch(`${supabaseUrl}/functions/v1/sync-sheets`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({ transaction_id: transactionId }),
      }).catch(e => console.error("sync-sheets error:", e));

      fetch(`${supabaseUrl}/functions/v1/sync-drive`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({ transaction_id: transactionId }),
      }).catch(e => console.error("sync-drive error:", e));
    }

    return new Response(JSON.stringify({ success: true, transaction: updated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("liff-action error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
