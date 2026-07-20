const SEND_SMS_HOOK_SECRET = Deno.env.get("SEND_SMS_HOOK_SECRET") ?? "";
const MESSAGEPRO_URL =
  Deno.env.get("MESSAGEPRO_URL") ?? "https://api-text.callpro.mn/v1/sms";
const MESSAGEPRO_KEY = Deno.env.get("MESSAGEPRO_KEY") ?? "";
const MESSAGEPRO_FROM = Deno.env.get("MESSAGEPRO_FROM") ?? "72777080";

// Verifies the Standard Webhooks signature Supabase Auth signs send_sms hook requests with.
// Secret format: "v1,whsec_<base64>" (multiple secrets during rotation separated by "|").
async function verifySignature(req: Request, rawBody: string): Promise<boolean> {
  if (!SEND_SMS_HOOK_SECRET) return false;

  const webhookId = req.headers.get("webhook-id");
  const webhookTimestamp = req.headers.get("webhook-timestamp");
  const webhookSignature = req.headers.get("webhook-signature");
  if (!webhookId || !webhookTimestamp || !webhookSignature) return false;

  const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const providedSigs = webhookSignature
    .split(" ")
    .map((s) => s.split(",")[1])
    .filter(Boolean);

  for (const secret of SEND_SMS_HOOK_SECRET.split("|")) {
    const secretB64 = secret.trim().replace(/^v1,/, "").replace(/^whsec_/, "");
    const keyBytes = Uint8Array.from(atob(secretB64), (c) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sigBuf = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(signedContent),
    );
    const expected = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
    if (providedSigs.includes(expected)) return true;
  }
  return false;
}

async function sendTextMessage(text: string, to8: string) {
  const url = `${MESSAGEPRO_URL}/send`;

  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": MESSAGEPRO_KEY,
    },
    body: JSON.stringify({
      from: MESSAGEPRO_FROM,
      to: to8,
      text,
    }),
  });
}

Deno.serve(async (req) => {
  try {
    const rawBody = await req.text();

    if (!(await verifySignature(req, rawBody))) {
      console.error("Invalid or missing webhook signature");
      return new Response(
        JSON.stringify({
          error: { http_code: 401, message: "Invalid signature" },
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const payload = JSON.parse(rawBody);
    console.log("Full Payload:", JSON.stringify(payload));

    const phone = payload.user?.phone || payload.phone || payload.sms?.phone;
    const otp = payload.sms?.otp;

    if (!phone || !otp) {
      console.error("Мэдээлэл дутуу ирлээ:", { phone, otp });
      return new Response(
        JSON.stringify({
          error: { http_code: 400, message: "Missing data" },
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const digitsOnly = phone.replace(/\D/g, "");
    const to8 = digitsOnly.length > 8 ? digitsOnly.slice(-8) : digitsOnly;

    if (!/^\d{8}$/.test(to8)) {
      console.error("Утасны дугаар буруу байна:", { phone, to8 });
      return new Response(
        JSON.stringify({
          error: { http_code: 400, message: "Invalid phone number" },
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const smsRes = await sendTextMessage(`Tanii nevtreh code: ${otp}`, to8);
    const smsText = await smsRes.text();

    console.log("SMS Provider Status:", smsRes.status);
    console.log("SMS Provider Response:", smsText);

    if (!smsRes.ok) {
      return new Response(
        JSON.stringify({
          error: {
            http_code: 500,
            message: `SMS provider error (${smsRes.status}): ${smsText}`,
          },
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Runtime Hook Error:", err.message);

    return new Response(
      JSON.stringify({
        error: { http_code: 500, message: err.message },
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});