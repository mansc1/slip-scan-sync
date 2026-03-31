import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SlipExtractionProvider {
  extract(imageBase64: string, mimeType: string): Promise<SlipExtractionResult>;
}

interface SlipExtractionResult {
  transaction_type: string | null;
  payment_status: string | null;
  amount: number | null;
  currency: string | null;
  date_display: string | null;
  time_display: string | null;
  transaction_datetime_iso: string | null;
  payer_name: string | null;
  receiver_name: string | null;
  merchant_name: string | null;
  bank_name: string | null;
  reference_no: string | null;
  merchant_code: string | null;
  transaction_code: string | null;
  fee: number | null;
  category_guess: string | null;
  confidence_score: number | null;
  raw_ocr_text: string | null;
}

class LovableAIProvider implements SlipExtractionProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async extract(imageBase64: string, mimeType: string): Promise<SlipExtractionResult> {
    const systemPrompt = `You are a Thai payment slip OCR expert. Extract structured data from Thai bank transfer/payment slip images.

Rules:
- Convert Buddhist Era year to Gregorian (e.g., 2569 → 2026, 2568 → 2025)
- Thai month abbreviations: ม.ค.=Jan, ก.พ.=Feb, มี.ค.=Mar, เม.ย.=Apr, พ.ค.=May, มิ.ย.=Jun, ก.ค.=Jul, ส.ค.=Aug, ก.ย.=Sep, ต.ค.=Oct, พ.ย.=Nov, ธ.ค.=Dec
- Masked names (e.g., "นายแมน ธ***") should be kept as-is
- Amount must be a number without commas
- transaction_type: transfer, bill_payment, merchant_payment, qr_payment, or other
- payment_status: success, failed, pending, or unknown
- category_guess: food, transport, shopping, bills, health, entertainment, education, travel, home, family, transfer, or other
- confidence_score: 0.0 to 1.0 indicating extraction confidence
- transaction_datetime_iso: ISO 8601 with timezone +07:00
- date_display: keep original Thai format from slip
- If a field is not visible or unclear, return null`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${imageBase64}` },
              },
              {
                type: "text",
                text: "Extract all payment details from this Thai payment slip image.",
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_slip_data",
              description: "Extract structured payment data from a Thai payment slip",
              parameters: {
                type: "object",
                properties: {
                  transaction_type: { type: "string", enum: ["transfer", "bill_payment", "merchant_payment", "qr_payment", "other"], nullable: true },
                  payment_status: { type: "string", enum: ["success", "failed", "pending", "unknown"], nullable: true },
                  amount: { type: "number", nullable: true },
                  currency: { type: "string", nullable: true },
                  date_display: { type: "string", nullable: true },
                  time_display: { type: "string", nullable: true },
                  transaction_datetime_iso: { type: "string", nullable: true },
                  payer_name: { type: "string", nullable: true },
                  receiver_name: { type: "string", nullable: true },
                  merchant_name: { type: "string", nullable: true },
                  bank_name: { type: "string", nullable: true },
                  reference_no: { type: "string", nullable: true },
                  merchant_code: { type: "string", nullable: true },
                  transaction_code: { type: "string", nullable: true },
                  fee: { type: "number", nullable: true },
                  category_guess: { type: "string", enum: ["food", "transport", "shopping", "bills", "health", "entertainment", "education", "travel", "home", "family", "transfer", "other"], nullable: true },
                  confidence_score: { type: "number", nullable: true },
                  raw_ocr_text: { type: "string", nullable: true },
                },
                required: ["amount", "confidence_score"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_slip_data" } },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("AI Gateway error:", response.status, text);
      if (response.status === 429) throw new Error("Rate limited, please try again later");
      if (response.status === 402) throw new Error("AI credits exhausted");
      throw new Error(`AI extraction failed: ${response.status}`);
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No extraction result from AI");
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    return {
      transaction_type: parsed.transaction_type || null,
      payment_status: parsed.payment_status || null,
      amount: parsed.amount ?? null,
      currency: parsed.currency || "THB",
      date_display: parsed.date_display || null,
      time_display: parsed.time_display || null,
      transaction_datetime_iso: parsed.transaction_datetime_iso || null,
      payer_name: parsed.payer_name || null,
      receiver_name: parsed.receiver_name || null,
      merchant_name: parsed.merchant_name || null,
      bank_name: parsed.bank_name || null,
      reference_no: parsed.reference_no || null,
      merchant_code: parsed.merchant_code || null,
      transaction_code: parsed.transaction_code || null,
      fee: parsed.fee ?? 0,
      category_guess: parsed.category_guess || "other",
      confidence_score: parsed.confidence_score ?? 0.5,
      raw_ocr_text: parsed.raw_ocr_text || null,
    };
  }
}

function getProvider(): SlipExtractionProvider {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
  return new LovableAIProvider(apiKey);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { image, mimeType, source, lineUserId, lineMessageId } = await req.json();
    if (!image) {
      return new Response(JSON.stringify({ error: "image (base64) is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get auth context
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let userId: string | null = null;
    if (authHeader) {
      const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!);
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await anonClient.auth.getUser(token);
      userId = user?.id || null;
    }

    // Store image in slip-images bucket
    const fileExt = mimeType === "image/png" ? "png" : "jpg";
    const filePath = `${userId || "anonymous"}/${crypto.randomUUID()}.${fileExt}`;
    const imageBuffer = Uint8Array.from(atob(image), c => c.charCodeAt(0));

    const { error: uploadError } = await supabase.storage
      .from("slip-images")
      .upload(filePath, imageBuffer, { contentType: mimeType || "image/jpeg" });

    if (uploadError) {
      console.error("Upload error:", uploadError);
    }

    // Compute simple image hash for dedup
    const hashBuffer = await crypto.subtle.digest("SHA-256", imageBuffer);
    const imageHash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    // Check duplicate by hash
    const { data: existing } = await supabase
      .from("transactions")
      .select("id")
      .eq("image_hash", imageHash)
      .limit(1);

    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({
        error: "Duplicate slip detected",
        existing_transaction_id: existing[0].id,
      }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract
    const provider = getProvider();
    let extractionResult: SlipExtractionResult;
    let extractionFailed = false;
    let errorMessage = "";

    try {
      extractionResult = await provider.extract(image, mimeType || "image/jpeg");
    } catch (extractErr: any) {
      console.error("Extraction failed:", extractErr);
      extractionFailed = true;
      errorMessage = extractErr.message || "Extraction failed";
      extractionResult = {
        transaction_type: null, payment_status: null, amount: null,
        currency: "THB", date_display: null, time_display: null,
        transaction_datetime_iso: null, payer_name: null, receiver_name: null,
        merchant_name: null, bank_name: null, reference_no: null,
        merchant_code: null, transaction_code: null, fee: null,
        category_guess: null, confidence_score: null, raw_ocr_text: null,
      };
    }

    // Create transaction
    const { data: txData, error: txError } = await supabase
      .from("transactions")
      .insert({
        user_id: userId,
        status: extractionFailed ? "extraction_failed" : "pending_confirmation",
        transaction_type: extractionResult.transaction_type,
        payment_status: extractionResult.payment_status,
        amount: extractionResult.amount,
        currency: extractionResult.currency,
        date_display: extractionResult.date_display,
        time_display: extractionResult.time_display,
        transaction_datetime_iso: extractionResult.transaction_datetime_iso,
        payer_name: extractionResult.payer_name,
        receiver_name: extractionResult.receiver_name,
        merchant_name: extractionResult.merchant_name,
        bank_name: extractionResult.bank_name,
        reference_no: extractionResult.reference_no,
        merchant_code: extractionResult.merchant_code,
        transaction_code: extractionResult.transaction_code,
        fee: extractionResult.fee,
        category_guess: extractionResult.category_guess,
        confidence_score: extractionResult.confidence_score,
        raw_ocr_text: extractionResult.raw_ocr_text,
        raw_provider_response: extractionFailed ? { error: errorMessage } : extractionResult,
        parsed_result: extractionFailed ? null : extractionResult,
        image_hash: imageHash,
        source_image_url: filePath,
        source: source || "manual",
        sheets_sync_status: "not_applicable",
        drive_sync_status: "not_applicable",
        notes: extractionFailed ? `Extraction failed: ${errorMessage}` : null,
      })
      .select()
      .single();

    if (txError) throw txError;

    // Create transaction_images record
    await supabase.from("transaction_images").insert({
      transaction_id: txData.id,
      file_path: filePath,
      mime_type: mimeType || "image/jpeg",
    });

    return new Response(JSON.stringify({
      transaction_id: txData.id,
      status: txData.status,
      extraction: extractionResult,
      extraction_failed: extractionFailed,
      error_message: extractionFailed ? errorMessage : null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("extract-slip error:", e);
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
