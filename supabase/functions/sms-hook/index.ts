const SEND_SMS_HOOK_SECRET = Deno.env.get("SEND_SMS_HOOK_SECRET") ?? "";
const MESSAGEPRO_URL =
  Deno.env.get("MESSAGEPRO_URL") ?? "https://api-text.callpro.mn/v1/sms";
const MESSAGEPRO_KEY = Deno.env.get("MESSAGEPRO_KEY") ?? "";
const MESSAGEPRO_FROM = Deno.env.get("MESSAGEPRO_FROM") ?? "72777080";

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
    const payload = await req.json();
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