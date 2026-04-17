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
    const { action, transactionId, idToken, updates, acknowledgeDuplicates } = await req.json();

    if (!action || !idToken) {
      return new Response(JSON.stringify({ error: "Missing action or idToken" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["confirm", "ignore", "update", "cancel", "create"].includes(action)) {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // transactionId is required for all actions except create
    if (action !== "create" && !transactionId) {
      return new Response(JSON.stringify({ error: "Missing transactionId" }), {
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

    // ---- CREATE: insert a new manual transaction ----
    if (action === "create") {
      const allowed = ["amount", "merchant_name", "category_final", "category_guess", "date_display", "time_display", "notes", "transaction_type", "payment_method", "currency", "source", "status", "transaction_datetime_iso", "reference_no"];
      const insertPayload: Record<string, any> = { line_user_id: verifiedUserId };
      if (updates && typeof updates === "object") {
        for (const key of allowed) {
          if (key in updates) insertPayload[key] = updates[key];
        }
      }
      // Enforce manual_entry source and confirmed status for MVP
      insertPayload.source = "manual_entry";
      insertPayload.status = insertPayload.status || "confirmed";

      // Server-side duplicate guard
      if (!acknowledgeDuplicates) {
        const dupCheck = await runDuplicateCheck(supabase, {
          ownerLineUserId: verifiedUserId,
          amount: insertPayload.amount ?? null,
          datetime: insertPayload.transaction_datetime_iso ?? null,
          merchant: insertPayload.merchant_name ?? null,
          reference_no: insertPayload.reference_no ?? null,
          image_hash: null,
          exclude_id: null,
        });
        if (dupCheck.hardMatch) {
          return new Response(JSON.stringify({
            error: "Duplicate transaction detected",
            duplicate: "hard",
            hardMatch: dupCheck.hardMatch,
            probableMatches: [],
          }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        if (dupCheck.probableMatches.length > 0) {
          return new Response(JSON.stringify({
            error: "Probable duplicate detected",
            duplicate: "probable",
            hardMatch: null,
            probableMatches: dupCheck.probableMatches,
          }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      const { data: created, error: createErr } = await supabase
        .from("transactions")
        .insert(insertPayload)
        .select()
        .single();

      if (createErr) {
        console.error("liff-action create error:", createErr);
        return new Response(JSON.stringify({ error: "Create failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Audit override if user acknowledged
      if (acknowledgeDuplicates && created) {
        await logOverride(supabase, created.id, verifiedUserId, null, "acknowledged_on_create");
      }

      return new Response(JSON.stringify({ success: true, transaction: created }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Existing actions: confirm, ignore, update, cancel ----

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
      const allowedUpdate = ["amount", "merchant_name", "category_final", "date_display", "time_display", "notes", "transaction_type", "payment_method", "transaction_datetime_iso"];
      updatePayload = {};
      if (updates && typeof updates === "object") {
        for (const key of allowedUpdate) {
          if (key in updates) updatePayload[key] = updates[key];
        }
      }

      // Server-side duplicate guard for update — only when amount or datetime actually change
      if (!acknowledgeDuplicates && (updatePayload.amount !== undefined || updatePayload.transaction_datetime_iso !== undefined)) {
        const dupCheck = await runDuplicateCheck(supabase, {
          ownerLineUserId: verifiedUserId,
          amount: updatePayload.amount ?? null,
          datetime: updatePayload.transaction_datetime_iso ?? null,
          merchant: updatePayload.merchant_name ?? null,
          reference_no: null,
          image_hash: null,
          exclude_id: transactionId,
        });
        if (dupCheck.hardMatch) {
          return new Response(JSON.stringify({
            error: "Duplicate transaction detected",
            duplicate: "hard",
            hardMatch: dupCheck.hardMatch,
            probableMatches: [],
          }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        if (dupCheck.probableMatches.length > 0) {
          return new Response(JSON.stringify({
            error: "Probable duplicate detected",
            duplicate: "probable",
            hardMatch: null,
            probableMatches: dupCheck.probableMatches,
          }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      // Always bump updated_at
      updatePayload.updated_at = new Date().toISOString();

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

    // Audit override on update if acknowledged
    if (acknowledgeDuplicates && action === "update") {
      await logOverride(supabase, transactionId, verifiedUserId, null, "acknowledged_on_update");
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

// ---------- Helpers ----------

async function runDuplicateCheck(supabase: any, args: {
  ownerUserId?: string | null;
  ownerLineUserId?: string | null;
  amount: number | null;
  datetime: string | null;
  merchant: string | null;
  reference_no: string | null;
  image_hash: string | null;
  exclude_id: string | null;
}): Promise<{ hardMatch: any | null; probableMatches: any[] }> {
  const { data, error } = await supabase.rpc("find_duplicate_candidates", {
    _owner_user_id: args.ownerUserId ?? null,
    _owner_line_user_id: args.ownerLineUserId ?? null,
    _amount: args.amount,
    _datetime: args.datetime,
    _merchant: args.merchant,
    _reference_no: args.reference_no,
    _image_hash: args.image_hash,
    _exclude_id: args.exclude_id,
  });
  if (error) {
    console.error("runDuplicateCheck error:", error);
    return { hardMatch: null, probableMatches: [] };
  }
  const list = data || [];
  const hardMatch = list.find((c: any) => c.match_type === "hard_hash" || c.match_type === "hard_reference") || null;
  const probableMatches = list.filter((c: any) => c.match_type === "probable");
  return { hardMatch, probableMatches };
}

async function logOverride(
  supabase: any,
  newTxId: string | null,
  ownerLineUserId: string | null,
  matchedTxId: string | null,
  reason: string,
) {
  try {
    await supabase.from("duplicate_overrides").insert({
      new_transaction_id: newTxId,
      matched_transaction_id: matchedTxId,
      duplicate_type: "probable",
      owner_line_user_id: ownerLineUserId,
      reason,
    });
  } catch (e) {
    console.error("logOverride failed:", e);
  }
}
