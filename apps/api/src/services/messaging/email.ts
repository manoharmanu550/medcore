// Brevo email transport.
// Uses the Brevo HTTP API for transactional email delivery.

import Brevo from "@getbrevo/brevo";

let initialized = false;
let apiInstance: Brevo.TransactionalEmailsApi | null = null;

function ensureInitialized(): { ok: true } | { ok: false; error: string } {
  if (initialized && apiInstance) return { ok: true };

  const key = process.env.BREVO_API_KEY;

  if (!key) {
    return {
      ok: false,
      error:
        "Email is not configured: BREVO_API_KEY is missing. " +
        "Add your Brevo API key to the API service environment variables.",
    };
  }

  if (!process.env.BREVO_FROM_EMAIL) {
    return {
      ok: false,
      error:
        "Email is not configured: BREVO_FROM_EMAIL is missing. " +
        "Add the verified sender email from your Brevo account.",
    };
  }

  const api = new Brevo.TransactionalEmailsApi();

  api.setApiKey(
    Brevo.TransactionalEmailsApiApiKeys.apiKey,
    key,
  );

  apiInstance = api;
  initialized = true;

  return { ok: true };
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    type?: string;
    disposition?: "attachment" | "inline";
  }>;
}

export interface SendEmailResult {
  ok: boolean;
  error?: string;
  messageId?: string;
}

export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const init = ensureInitialized();

  if (!init.ok) {
    return { ok: false, error: init.error };
  }

  if (!input.to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.to)) {
    return {
      ok: false,
      error: `Invalid recipient email: ${input.to}`,
    };
  }

  try {
    const sendSmtpEmail = new Brevo.SendSmtpEmail();

    sendSmtpEmail.subject = input.subject;

    sendSmtpEmail.htmlContent = input.html;

    sendSmtpEmail.textContent =
      input.text || stripHtml(input.html);

    sendSmtpEmail.sender = {
      name: process.env.BREVO_FROM_NAME || "MedCore",
      email: process.env.BREVO_FROM_EMAIL!,
    };

    sendSmtpEmail.to = [
      {
        email: input.to,
      },
    ];

    if (input.replyTo) {
      sendSmtpEmail.replyTo = {
        email: input.replyTo,
      };
    }

    if (input.attachments?.length) {
      sendSmtpEmail.attachment = input.attachments.map((a) => ({
        name: a.filename,
        content:
          typeof a.content === "string"
            ? Buffer.from(a.content).toString("base64")
            : a.content.toString("base64"),
      }));
    }

    const response =
      await apiInstance!.sendTransacEmail(sendSmtpEmail);

    return {
      ok: true,
      messageId: response?.messageId,
    };
  } catch (err: unknown) {
    const e = err as {
      message?: string;
      response?: {
        body?: {
          message?: string;
        };
      };
    };

    const detail =
      e.response?.body?.message ||
      e.message ||
      "Unknown Brevo email error";

    return {
      ok: false,
      error: detail,
    };
  }
}

function stripHtml(html: string): string {
  const blockTags =
    /<(style|script|noscript|iframe|object|embed)[\s\S]*?<\/\1>/gi;

  let prev: string;
  let next = html;

  do {
    prev = next;
    next = next.replace(blockTags, "");
  } while (next !== prev);

  do {
    prev = next;
    next = next.replace(/<[^>]+>/g, "");
  } while (next !== prev);

  return next.replace(/\s+/g, " ").trim();
}