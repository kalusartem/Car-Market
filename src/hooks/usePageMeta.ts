import { useEffect } from "react";

type PageMeta = {
  title: string;
  description?: string;
  /** Path (and query) the canonical URL should point at, e.g. "/listings/abc". */
  canonicalPath?: string;
  image?: string | null;
  jsonLd?: Record<string, unknown> | null;
  noindex?: boolean;
};

const SITE = "Car Market";
const DEFAULT_DESCRIPTION =
  document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? "";

function upsert(selector: string, create: () => HTMLElement) {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  return el;
}

function setMeta(attr: "name" | "property", key: string, content: string) {
  const el = upsert(`meta[${attr}="${key}"]`, () => {
    const m = document.createElement("meta");
    m.setAttribute(attr, key);
    return m;
  });
  el.setAttribute("content", content);
}

/** Per-page title, description, canonical, Open Graph and JSON-LD for client-side navigation.
 *  Crawlers that don't run JS get the same tags from the Cloudflare Pages Functions. */
export function usePageMeta({
  title,
  description = DEFAULT_DESCRIPTION,
  canonicalPath,
  image,
  jsonLd,
  noindex,
}: PageMeta) {
  const jsonLdText = jsonLd ? JSON.stringify(jsonLd) : null;

  useEffect(() => {
    const fullTitle = title.includes(SITE) ? title : `${title} | ${SITE}`;
    const url = window.location.origin + (canonicalPath ?? window.location.pathname);
    const previousTitle = document.title;

    document.title = fullTitle;
    setMeta("name", "description", description);
    setMeta("property", "og:title", fullTitle);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", url);
    if (image) {
      setMeta("property", "og:image", image);
      setMeta("name", "twitter:card", "summary_large_image");
    }

    const canonical = upsert('link[rel="canonical"]', () => {
      const l = document.createElement("link");
      l.rel = "canonical";
      return l;
    }) as HTMLLinkElement;
    canonical.href = url;

    if (noindex) setMeta("name", "robots", "noindex");

    let script: HTMLScriptElement | null = null;
    if (jsonLdText) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.dataset.pageMeta = "true";
      script.text = jsonLdText;
      document.head.appendChild(script);
    }

    return () => {
      document.title = previousTitle;
      script?.remove();
      document.head.querySelector('meta[name="robots"]')?.remove();
      document.head.querySelector('link[rel="canonical"]')?.remove();
      document.head.querySelector('meta[property="og:image"]')?.remove();
      setMeta("name", "twitter:card", "summary");
    };
  }, [title, description, canonicalPath, image, jsonLdText, noindex]);
}
