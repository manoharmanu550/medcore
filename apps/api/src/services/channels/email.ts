// Email channel adapter — Brevo HTTP API
//
// Env vars:
//   BREVO_API_KEY     — Brevo API key
//   BREVO_FROM_EMAIL  — verified sender email

import type { ChannelResult } from "./whatsapp";

export async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<ChannelResult> {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.BREVO_FROM_EMAIL;

  if (!apiKey || !from) {
    console.error("[Email] BREVO_API_KEY or BREVO_FROM_EMAIL is missing");
    return { ok: false, error: "Brevo email configuration is missing" };
  }

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: {
          email: from,
        },
        to: [
          {
            email: to,
          },
        ],
        subject,
        textContent: body,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("[Email] Brevo error:", res.status, errorText);
      return {
        ok: false,
        error: `Brevo HTTP ${res.status}`,
      };
    }

    const data = await res.json().catch(() => ({}));

    return {
      ok: true,
      messageId: data.messageId,
    };
  } catch (e) {
    console.error("[Email] Brevo request failed:", e);
    return {
      ok: false,
      error: String(e),
    };
  }
}