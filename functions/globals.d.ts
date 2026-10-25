// Minimal typings for the Cloudflare Pages Functions runtime, so the functions can be
// type-checked without pulling in @cloudflare/workers-types.

interface HTMLRewriterElement {
  remove(): HTMLRewriterElement;
  append(content: string, options?: { html?: boolean }): HTMLRewriterElement;
  setInnerContent(content: string, options?: { html?: boolean }): HTMLRewriterElement;
}

declare class HTMLRewriter {
  on(
    selector: string,
    handlers: { element?: (el: HTMLRewriterElement) => void | Promise<void> },
  ): HTMLRewriter;
  transform(response: Response): Response;
}
