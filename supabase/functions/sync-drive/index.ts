import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getGoogleAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);

  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/drive.file",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  }));

  const pemContent = sa.private_key.replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "").replace(/\s/g, "");
  const binaryKey = Uint8Array.from(atob(pemContent), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", binaryKey, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]
  );
  const signatureInput = new TextEncoder().encode(`${header}.${payload}`);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, signatureInput);
  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  const jwt = `${header}.${payload}.${sig}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error("Failed to get Google access token");
  return tokenData.access_token;
}

async function findOrCreateFolder(name: string, parentId: string, accessToken: string): Promise<string> {
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();
  if (searchData.files?.length > 0) return searchData.files[0].id;

  const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  });
  const created = await createRes.json();
  return created.id;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  const rootFolderId = Deno.env.get("GOOGLE_DRIVE_FOLDER_ID");

  if (!serviceAccountJson || !rootFolderId) {
    return new Response(JSON.stringify({ error: "Google Drive not configured", skipped: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { transaction_id } = await req.json();
    if (!transaction_id) {
      return new Response(JSON.stringify({ error: "transaction_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: tx, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", transaction_id)
      .single();

    if (error || !tx) {
      return new Response(JSON.stringify({ error: "Transaction not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (tx.drive_sync_status === "synced") {
      return new Response(JSON.stringify({ skipped: true, reason: "already synced" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Do not sync cancelled transactions
    if (tx.status === "cancelled") {
      return new Response(JSON.stringify({ skipped: true, reason: "cancelled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!tx.source_image_url) {
      await supabase.from("transactions").update({ drive_sync_status: "failed" }).eq("id", transaction_id);
      return new Response(JSON.stringify({ error: "No image to upload" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download image from storage
    const { data: imageData, error: downloadError } = await supabase.storage
      .from("slip-images")
      .download(tx.source_image_url);

    if (downloadError || !imageData) {
      await supabase.from("transactions").update({ drive_sync_status: "failed" }).eq("id", transaction_id);
      throw new Error("Failed to download image from storage");
    }

    const accessToken = await getGoogleAccessToken(serviceAccountJson);

    // Create year/month folder structure
    const txDate = tx.transaction_datetime_iso ? new Date(tx.transaction_datetime_iso) : new Date(tx.created_at);
    const year = txDate.getFullYear().toString();
    const month = String(txDate.getMonth() + 1).padStart(2, "0");

    const yearFolderId = await findOrCreateFolder(year, rootFolderId, accessToken);
    const monthFolderId = await findOrCreateFolder(month, yearFolderId, accessToken);

    // Name: YYYY-MM-DD_amount_merchant_reference
    const dateStr = `${year}-${month}-${String(txDate.getDate()).padStart(2, "0")}`;
    const amountStr = tx.amount ? tx.amount.toString() : "0";
    const merchantStr = (tx.merchant_name || tx.receiver_name || "unknown").replace(/[/\\?%*:|"<>]/g, "_").slice(0, 30);
    const refStr = (tx.reference_no || tx.id.slice(0, 8)).replace(/[/\\?%*:|"<>]/g, "_");
    const fileName = `${dateStr}_${amountStr}_${merchantStr}_${refStr}.jpg`;

    // Upload via multipart
    const boundary = "----FormBoundary" + crypto.randomUUID();
    const metadata = JSON.stringify({ name: fileName, parents: [monthFolderId] });
    const imageBytes = new Uint8Array(await imageData.arrayBuffer());

    const bodyParts = [
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
      `--${boundary}\r\nContent-Type: image/jpeg\r\n\r\n`,
    ];

    const encoder = new TextEncoder();
    const part1 = encoder.encode(bodyParts[0]);
    const part2 = encoder.encode(bodyParts[1]);
    const ending = encoder.encode(`\r\n--${boundary}--`);

    const fullBody = new Uint8Array(part1.length + part2.length + imageBytes.length + ending.length);
    fullBody.set(part1, 0);
    fullBody.set(part2, part1.length);
    fullBody.set(imageBytes, part1.length + part2.length);
    fullBody.set(ending, part1.length + part2.length + imageBytes.length);

    const uploadRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: fullBody,
      }
    );

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error("Drive upload error:", errText);
      await supabase.from("transactions").update({ drive_sync_status: "failed" }).eq("id", transaction_id);
      throw new Error(`Drive upload failed: ${uploadRes.status}`);
    }

    const uploadedFile = await uploadRes.json();
    const driveUrl = `https://drive.google.com/file/d/${uploadedFile.id}/view`;

    await supabase.from("transactions").update({
      drive_sync_status: "synced",
      drive_file_url: driveUrl,
    }).eq("id", transaction_id);

    return new Response(JSON.stringify({ success: true, drive_url: driveUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("sync-drive error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
