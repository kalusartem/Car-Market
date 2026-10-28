// Minimal SMTP client (implicit TLS, port 465), the same one HomeFinder and dustfront use. The socket comes
// from the caller: `cloudflare:sockets` in the Pages Function (functions/api/listings/notify.ts) and node:tls
// in the self-hosted server (server/smtp.ts).
//
// Settings: SMTP_HOST / SMTP_PORT (465) / SMTP_USER / SMTP_PASS. With Brevo, SMTP_USER is the "SMTP login"
// from Settings → SMTP & API and SMTP_PASS the xsmtpsib- key. NOTIFY_FROM must be a verified sender.

export interface MailEnv {
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  NOTIFY_FROM?: string;
}

export interface Conn {
  write(s: string): Promise<void>;
  /** Resolves with the next complete reply (last line "NNN text"). */
  reply(): Promise<{ code: number; text: string }>;
  close(): Promise<void>;
}

export type Connect = (host: string, port: number) => Promise<Conn>;

const enc = new TextEncoder();
const b64 = (s: string) => btoa(String.fromCharCode(...enc.encode(s)));

/** Feeds raw socket text in, returns a reply once its last line ("NNN text") has arrived. */
export function replyParser() {
  let buf = "";
  return (chunk: string) => {
    buf += chunk;
    const lines = buf.split("\r\n").filter(Boolean);
    const last = lines[lines.length - 1];
    if (buf.endsWith("\r\n") && last && /^\d{3} /.test(last)) {
      buf = "";
      return { code: +last.slice(0, 3), text: lines.join("\n") };
    }
    return null;
  };
}

/** Strip header-injection characters from anything placed in an SMTP header. */
const headerSafe = (s: string) => s.replace(/[\r\n]+/g, " ").slice(0, 200);

export function smtpConfigured(env: MailEnv): boolean {
  return Boolean(env.SMTP_HOST?.trim() && env.SMTP_USER?.trim() && env.SMTP_PASS?.trim());
}

export async function sendMail(
  env: MailEnv,
  connect: Connect,
  { to, subject, text }: { to: string; subject: string; text: string },
) {
  const host = env.SMTP_HOST?.trim();
  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASS?.trim();
  const port = Number(env.SMTP_PORT) || 465;
  if (!host || !user || !pass) throw new Error("SMTP not configured");
  const from = env.NOTIFY_FROM?.trim() || to;

  const conn = await connect(host, port);
  const timeout = setTimeout(() => void conn.close(), 15_000);
  const cmd = async (line: string | null, expect?: number) => {
    if (line != null) await conn.write(line + "\r\n");
    const res = await conn.reply();
    if (expect && res.code !== expect) throw new Error(`SMTP said no (expected ${expect}): ${res.text}`);
    return res;
  };
  try {
    await cmd(null, 220);
    await cmd("EHLO car-market.local", 250);
    await cmd("AUTH LOGIN", 334);
    await cmd(b64(user), 334);
    await cmd(b64(pass), 235);
    await cmd(`MAIL FROM:<${from}>`, 250);
    await cmd(`RCPT TO:<${to}>`, 250);
    await cmd("DATA", 354);
    const body = text.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
    await cmd(
      `From: Car Market <${from}>\r\n` +
        `To: <${to}>\r\n` +
        `Subject: =?utf-8?B?${b64(headerSafe(subject))}?=\r\n` +
        `Date: ${new Date().toUTCString()}\r\n` +
        `MIME-Version: 1.0\r\n` +
        `Content-Type: text/plain; charset=utf-8\r\n` +
        `Content-Transfer-Encoding: 8bit\r\n\r\n` +
        `${body}\r\n.`,
      250,
    );
    await cmd("QUIT").catch(() => {});
  } finally {
    clearTimeout(timeout);
    await conn.close();
  }
}
