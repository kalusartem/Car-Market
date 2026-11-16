// POST /api/contact — the Contact page posts {name, email, message}; we email it to the site operator
// through the same SMTP settings as the listing-review notice (functions/_notify.ts). The operator's address
// is only ever read server-side (NOTIFY_TO) and never sent to the browser. Without SMTP it is only logged.

import type { Env } from "./_lib";
import { sendMail, smtpConfigured, type Connect } from "./_mail";

const DEFAULT_NOTIFY_TO = "kalusartem@gmail.com";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });

export async function sendContact(request: Request, env: Env, connect: Connect): Promise<Response> {
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  // Hidden "website" field: real people leave it empty, bots fill it. Pretend success.
  if (str(b.website, 200)) return json({ ok: true });

  const name = str(b.name, 100);
  const email = str(b.email, 200);
  const message = str(b.message, 4000);
  if (message.length < 10) return json({ error: "Please write a few more words." }, 400);
  if (email && !EMAIL.test(email)) return json({ error: "That email address looks wrong." }, 400);

  if (!smtpConfigured(env)) {
    console.warn("[contact] message received, logged only — SMTP not configured");
    return json({ error: "Contact is not available right now." }, 503);
  }
  try {
    await sendMail(env, connect, {
      to: env.NOTIFY_TO?.trim() || DEFAULT_NOTIFY_TO,
      subject: `Car Market contact: ${name || "anonymous"}`,
      text: [`From: ${name || "(no name)"} <${email || "no email given"}>`, "", message].join("\n"),
    });
    return json({ ok: true });
  } catch (e) {
    console.error("[contact] email failed:", e);
    return json({ error: "Could not send your message. Please try again later." }, 502);
  }
}
