import tls from "node:tls";
import { replyParser, type Conn } from "../functions/_mail";

/** SMTP over node:tls for the self-hosted server (the Pages Function uses cloudflare:sockets instead). */
export async function connectNode(host: string, port: number): Promise<Conn> {
  const socket = tls.connect({ host, port, servername: host });
  await new Promise<void>((resolve, reject) => {
    socket.once("secureConnect", () => resolve());
    socket.once("error", reject);
  });
  const parse = replyParser();
  const pending: { code: number; text: string }[] = [];
  let wake: (() => void) | null = null;
  let failure: Error | null = null;
  socket.on("data", (chunk: Buffer) => {
    const r = parse(chunk.toString("utf8"));
    if (r) pending.push(r);
    wake?.();
  });
  socket.on("error", (e: Error) => ((failure = e), wake?.()));
  socket.on("end", () => ((failure ??= new Error("SMTP connection closed unexpectedly")), wake?.()));
  return {
    write: (s) => new Promise((resolve) => socket.write(s, () => resolve())),
    async reply() {
      while (!pending.length) {
        if (failure) throw failure;
        await new Promise<void>((r) => (wake = r));
      }
      return pending.shift()!;
    },
    close: async () => void socket.end(),
  };
}
