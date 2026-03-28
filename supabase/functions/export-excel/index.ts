import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import * as XLSX from "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { month } = await req.json();
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return new Response(JSON.stringify({ error: "month required (YYYY-MM)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    let userId: string | null = null;
    if (authHeader) {
      const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!);
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await anonClient.auth.getUser(token);
      userId = user?.id || null;
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const [year, mo] = month.split("-").map(Number);
    const startDate = new Date(year, mo - 1, 1).toISOString();
    const endDate = new Date(year, mo, 1).toISOString();

    let query = supabase
      .from("transactions")
      .select("*")
      .eq("status", "confirmed")
      .gte("created_at", startDate)
      .lt("created_at", endDate)
      .order("created_at", { ascending: true });

    if (userId) query = query.eq("user_id", userId);

    const { data: transactions, error } = await query;
    if (error) throw error;

    // Build XLSX
    const summaryData = [
      ["Personal Expenses Report"],
      [`Month: ${month}`],
      [`Generated: ${new Date().toISOString()}`],
      [`Total transactions: ${transactions?.length || 0}`],
      [`Total amount: ${(transactions || []).reduce((s, t) => s + (t.amount || 0), 0).toLocaleString()} THB`],
    ];

    const detailHeaders = [
      "Date", "Time", "Type", "Merchant/Receiver", "Amount", "Currency",
      "Category", "Bank", "Reference", "Status", "Notes",
    ];

    const detailRows = (transactions || []).map(t => [
      t.date_display || "",
      t.time_display || "",
      t.transaction_type || "",
      t.merchant_name || t.receiver_name || "",
      t.amount || 0,
      t.currency || "THB",
      t.category_final || t.category_guess || "",
      t.bank_name || "",
      t.reference_no || "",
      t.status,
      t.notes || "",
    ]);

    const wb = XLSX.utils.book_new();

    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

    const detailWs = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows]);
    XLSX.utils.book_append_sheet(wb, detailWs, "Transactions");

    const xlsxBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    // Upload to storage
    const fileName = `exports/personal-expenses-${month}.xlsx`;
    await supabase.storage.from("slip-images").upload(fileName, xlsxBuffer, {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: true,
    });

    const { data: signedUrl } = await supabase.storage
      .from("slip-images")
      .createSignedUrl(fileName, 3600);

    // Create export job record
    if (userId) {
      await supabase.from("export_jobs").insert({
        user_id: userId,
        type: "excel",
        status: "completed",
        file_url: signedUrl?.signedUrl || null,
        params: { month },
      });
    }

    return new Response(JSON.stringify({ url: signedUrl?.signedUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("export-excel error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
