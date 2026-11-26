// Test doubles for the Pages Functions: an in-memory SMTP connection and an in-memory Cache API.

import type { Conn, Connect } from "../../functions/_mail";
import type { EdgeCache } from "../../functions/_rateLimit";

/** A fake SMTP server that accepts everything and records what the client wrote. */
export function fakeSmtp({ failOn }: { failOn?: string } = {}) {
  const writes: string[] = [];
  const hosts: { host: string; port: number }[] = [];
  let pending = 220; // greeting
  const conn: Conn = {
    async write(s) {
      writes.push(s);
      const line = s.trimEnd();
      if (failOn && line.startsWith(failOn)) pending = 550;
      else if (line.startsWith("EHLO") || line.startsWith("MAIL") || line.startsWith("RCPT")) pending = 250;
      else if (line === "AUTH LOGIN") pending = 334;
      else if (line === "DATA") pending = 354;
      else if (line === "QUIT") pending = 221;
      else if (s.endsWith("\r\n.\r\n")) pending = 250; // end of message
      else pending = writes.length === 3 ? 334 : 235; // username, then password
    },
    async reply() {
      return { code: pending, text: `${pending} ok` };
    },
    async close() {},
  };
  const connect: Connect = async (host, port) => {
    hosts.push({ host, port });
    return conn;
  };
  /** The DATA payload (headers + body) of the one message sent, or undefined. */
  const message = () => writes.find((w) => w.endsWith("\r\n.\r\n"));
  return { connect, writes, hosts, message };
}

/** Decodes the RFC 2047 base64 subject from a raw message. */
export function subjectOf(message: string) {
  const m = /^Subject: =\?utf-8\?B\?([^?]*)\?=\r$/m.exec(message);
  return m ? new TextDecoder().decode(Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0))) : null;
}

/** An in-memory stand-in for caches.default. */
export function memoryCache(): EdgeCache & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    async match(url) {
      const v = store.get(url);
      return v === undefined ? undefined : new Response(v);
    },
    async put(url, res) {
      store.set(url, await res.text());
    },
  };
}

export const SMTP_ENV = {
  SMTP_HOST: "smtp.example.test",
  SMTP_PORT: "465",
  SMTP_USER: "user",
  SMTP_PASS: "pass",
  NOTIFY_TO: "owner@example.test",
  NOTIFY_FROM: "noreply@example.test",
};

export const ASSETS = { fetch: async () => new Response("") };
