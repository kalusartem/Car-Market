import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONTACT_LIMIT, sendContact } from "../../functions/_contact";
import type { Env } from "../../functions/_lib";
import { ASSETS, fakeSmtp, memoryCache, SMTP_ENV, subjectOf } from "./fakes";

const env: Env = { ASSETS, ...SMTP_ENV };

const post = (body: unknown, ip = "203.0.113.7") =>
  new Request("https://cars.example.test/api/contact", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const valid = { name: "Ann", email: "ann@example.test", message: "Is the Civic still for sale?" };

let cache: ReturnType<typeof memoryCache>;
beforeEach(() => {
  cache = memoryCache();
  vi.stubGlobal("caches", { default: cache });
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/contact", () => {
  it("sends the message to NOTIFY_TO", async () => {
    const smtp = fakeSmtp();
    const res = await sendContact(post(valid), env, smtp.connect);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(smtp.hosts).toEqual([{ host: "smtp.example.test", port: 465 }]);
    expect(smtp.writes).toContain("RCPT TO:<owner@example.test>\r\n");
    expect(smtp.writes).toContain("MAIL FROM:<noreply@example.test>\r\n");
    const msg = smtp.message()!;
    expect(subjectOf(msg)).toBe("Car Market contact: Ann");
    expect(msg).toContain("From: Ann <ann@example.test>");
    expect(msg).toContain("Is the Civic still for sale?");
  });

  it("rejects a too-short message", async () => {
    const smtp = fakeSmtp();
    const res = await sendContact(post({ ...valid, message: "hi" }), env, smtp.connect);
    expect(res.status).toBe(400);
    expect(smtp.hosts).toHaveLength(0);
  });

  it("rejects a malformed email", async () => {
    const smtp = fakeSmtp();
    const res = await sendContact(post({ ...valid, email: "not-an-email" }), env, smtp.connect);
    expect(res.status).toBe(400);
    expect(smtp.hosts).toHaveLength(0);
  });

  it("treats a non-JSON body as an empty form", async () => {
    const smtp = fakeSmtp();
    const res = await sendContact(post("{nope"), env, smtp.connect);
    expect(res.status).toBe(400);
    expect(smtp.hosts).toHaveLength(0);
  });

  it("pretends success when the honeypot is filled and sends nothing", async () => {
    const smtp = fakeSmtp();
    const res = await sendContact(post({ ...valid, website: "http://spam.example" }), env, smtp.connect);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(smtp.hosts).toHaveLength(0);
    expect(cache.store.size).toBe(0);
  });

  it("keeps CR/LF in the name out of the mail headers", async () => {
    const smtp = fakeSmtp();
    const name = "Eve\r\nBcc: victim@example.test\r\nX-Evil: 1";
    const res = await sendContact(post({ ...valid, name }), env, smtp.connect);
    expect(res.status).toBe(200);
    const msg = smtp.message()!;
    const headers = msg.slice(0, msg.indexOf("\r\n\r\n"));
    expect(headers).not.toMatch(/^(Bcc|X-Evil):/im);
    expect(subjectOf(msg)).not.toMatch(/[\r\n]/);
    expect(smtp.writes.filter((w) => w.startsWith("RCPT TO"))).toEqual(["RCPT TO:<owner@example.test>\r\n"]);
  });

  it("rejects an email address carrying a header break", async () => {
    const smtp = fakeSmtp();
    const res = await sendContact(post({ ...valid, email: "a@b.co\r\nBcc: x@y.z" }), env, smtp.connect);
    expect(res.status).toBe(400);
    expect(smtp.hosts).toHaveLength(0);
  });

  it("returns 503 without SMTP settings", async () => {
    const smtp = fakeSmtp();
    const res = await sendContact(post(valid), { ASSETS }, smtp.connect);
    expect(res.status).toBe(503);
    expect(smtp.hosts).toHaveLength(0);
  });

  it("returns 502 when the mail server refuses", async () => {
    const smtp = fakeSmtp({ failOn: "RCPT" });
    const res = await sendContact(post(valid), env, smtp.connect);
    expect(res.status).toBe(502);
  });

  it(`allows ${CONTACT_LIMIT.max} sends per IP per hour, then 429`, async () => {
    for (let i = 0; i < CONTACT_LIMIT.max; i++) {
      expect((await sendContact(post(valid), env, fakeSmtp().connect)).status).toBe(200);
    }
    const smtp = fakeSmtp();
    const res = await sendContact(post(valid), env, smtp.connect);
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(smtp.hosts).toHaveLength(0);
    // another IP is unaffected
    expect((await sendContact(post(valid, "198.51.100.1"), env, fakeSmtp().connect)).status).toBe(200);
  });

  it("opens a new window after an hour", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      for (let i = 0; i < CONTACT_LIMIT.max; i++) await sendContact(post(valid), env, fakeSmtp().connect);
      expect((await sendContact(post(valid), env, fakeSmtp().connect)).status).toBe(429);
      vi.advanceTimersByTime(CONTACT_LIMIT.windowMs + 1);
      expect((await sendContact(post(valid), env, fakeSmtp().connect)).status).toBe(200);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not limit when the Cache API is missing (Node server)", async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal("caches", undefined);
    for (let i = 0; i < CONTACT_LIMIT.max + 2; i++) {
      expect((await sendContact(post(valid), env, fakeSmtp().connect)).status).toBe(200);
    }
  });
});
