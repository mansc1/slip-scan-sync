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
    const body = await req.json();
    const {
      idToken,
      amount,
      datetime,
      merchant,
      reference_no,
      image_hash,
      exclude_id,
    } = body || {};

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Resolve owner identity (LINE token OR auth header)
    let ownerUserId: string | null = null;
    let ownerLineUserId: string | null = null;

    if (idToken) {
      const liffChannelId = Deno.env.get("LIFF_CHANNEL_ID") || "";
      ownerLineUserId = await verifyLineIdToken(idToken, liffChannelId);
      if (!ownerLineUserId) {
        return new Response(JSON.stringify({ error: "Invalid LINE identity" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
        const token = authHeader.replace("Bearer ", "");
        const { data: { user } } = await anonClient.auth.getUser(token);
        ownerUserId = user?.id || null;
      }
    }

    if (!ownerUserId && !ownerLineUserId) {
      // No owner — skip check (demo mode)
      return new Response(JSON.stringify({ hardMatch: null, probableMatches: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: candidates, error } = await supabase.rpc("find_duplicate_candidates", {
      _owner_user_id: ownerUserId,
      _owner_line_user_id: ownerLineUserId,
      _amount: amount ?? null,
      _datetime: datetime ?? null,
      _merchant: merchant ?? null,
      _reference_no: reference_no ?? null,
      _image_hash: image_hash ?? null,
      _exclude_id: exclude_id ?? null,
    });

    if (error) {
      console.error("find_duplicate_candidates error:", error);
      return new Response(JSON.stringify({ error: "Duplicate check failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const list = candidates || [];
    const hardMatch = list.find((c: any) => c.match_type === "hard_hash" || c.match_type === "hard_reference") || null;
    const probableMatches = list.filter((c: any) => c.match_type === "probable");

    return new Response(JSON.stringify({ hardMatch, probableMatches }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("check-duplicate error:", e);
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
