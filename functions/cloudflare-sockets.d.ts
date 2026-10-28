// The part of the Workers runtime's TCP socket API that functions/api/listings/notify.ts uses.
declare module "cloudflare:sockets" {
  export interface Socket {
    readable: ReadableStream<Uint8Array>;
    writable: WritableStream<Uint8Array>;
    close(): Promise<void>;
  }
  export function connect(
    address: { hostname: string; port: number },
    options?: { secureTransport?: "off" | "on" | "starttls" },
  ): Socket;
}
