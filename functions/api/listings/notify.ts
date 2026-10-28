import { connect } from "cloudflare:sockets";
import type { Ctx } from "../../_lib";
import { replyParser, type Conn } from "../../_mail";
import { notifyListingReview } from "../../_notify";

/** SMTP over a Workers TCP socket (node:tls isn't available on Pages). */
async function connectWorkers(host: string, port: number): Promise<Conn> {
  const socket = connect({ hostname: host, port }, { secureTransport: "on" });
  const writer = socket.writable.getWriter();
  const reader = socket.readable.getReader();
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const parse = replyParser();
  return {
    write: (s) => writer.write(enc.encode(s)),
    async reply() {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) throw new Error("SMTP connection closed unexpectedly");
        const r = parse(dec.decode(value, { stream: true }));
        if (r) return r;
      }
    },
    close: () => socket.close().catch(() => {}),
  };
}

export const onRequestPost = ({ request, env }: Ctx) => notifyListingReview(request, env, connectWorkers);
