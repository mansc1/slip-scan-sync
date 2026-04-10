import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifiedIdentity {
  lineUserId: string;
  displayName: string;
}

async function verifyLineIdToken(idToken: string): Promise<VerifiedIdentity | null> {
  const channelId = Deno.env.get("LIFF_CHANNEL_ID");
  if (!channelId) {
    console.error("LIFF_CHANNEL_ID not configured");
    return null;
  }

  const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
  });

  if (!res.ok) {
    console.error("LINE token verify failed:", res.status, await res.text());
    return null;
  }

  const data = await res.json();
  return { lineUserId: data.sub, displayName: data.name || data.sub };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { idToken } = await req.json();
    if (!idToken || typeof idToken !== "string") {
      return new Response(JSON.stringify({ error: "idToken is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Server-side LINE identity verification — never trust client claims
    const identity = await verifyLineIdToken(idToken);
    if (!identity) {
      return new Response(JSON.stringify({ error: "Invalid LINE identity" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    console.log(`Verified LINE user: ${identity.lineUserId} (${identity.displayName})`);

    // Fetch transactions for this LINE user
    const { data: transactions, error } = await supabase
      .from("transactions")
      .select("id, amount, currency, merchant_name, receiver_name, payer_name, bank_name, category_guess, category_final, status, transaction_datetime_iso, date_display, time_display, transaction_type, payment_status, notes, created_at")
      .eq("line_user_id", identity.lineUserId)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw error;

    const txs = transactions || [];

    // Exclude cancelled from stats (but still return them for filtering)
    const nonCancelled = txs.filter((t: any) => t.status !== "cancelled");
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const confirmed = nonCancelled.filter((t: any) => t.status === "confirmed");

    const thisMonth = confirmed.filter((t: any) => {
      if (!t.transaction_datetime_iso) return false;
      const d = new Date(t.transaction_datetime_iso);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const thisYear = confirmed.filter((t: any) => {
      if (!t.transaction_datetime_iso) return false;
      return new Date(t.transaction_datetime_iso).getFullYear() === currentYear;
    });

    const pendingCount = nonCancelled.filter((t: any) => t.status === "pending_confirmation").length;

    const stats = {
      monthlyTotal: thisMonth.reduce((sum: number, t: any) => sum + (t.amount || 0), 0),
      yearlyTotal: thisYear.reduce((sum: number, t: any) => sum + (t.amount || 0), 0),
      slipCountMonth: thisMonth.length,
      pendingCount,
    };

    return new Response(JSON.stringify({
      transactions: txs,
      stats,
      role: "line_user",
      displayName: identity.displayName,
      lineUserId: identity.lineUserId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("my-transactions error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
