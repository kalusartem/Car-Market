import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, ImageIcon, XIcon } from "../../../components/icons";
import { ResizedImage } from "../../../components/ResizedImage";

/** `full` is the original upload; `large` and `thumb` are resized copies for the page. */
export type GalleryPhoto = { full: string; large: string; thumb: string };

type Props = { photos: GalleryPhoto[]; alt: string };

export function Gallery({ photos, alt }: Props) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const count = photos.length;

  const go = useCallback(
    (delta: number) => setIndex((i) => (count ? (i + delta + count) % count : 0)),
    [count],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const restore = opener.current;
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      restore?.focus();
    };
  }, [open, go]);

  if (!count) {
    return (
      <div className="flex aspect-[16/10] items-center justify-center rounded-2xl border border-line bg-surface-3 text-subtle">
        <div className="text-center">
          <ImageIcon size={40} className="mx-auto" />
          <p className="mt-2 text-sm">No photos yet</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl border border-line bg-surface-3">
        <button
          type="button"
          className="block w-full"
          aria-label={`Open photo ${index + 1} of ${count} full screen`}
          onClick={(e) => {
            opener.current = e.currentTarget;
            setOpen(true);
          }}
        >
          <ResizedImage
            key={photos[index].large}
            src={photos[index].large}
            fallback={photos[index].full}
            alt={`${alt} – photo ${index + 1} of ${count}`}
            className="aspect-[16/10] w-full object-cover"
          />
        </button>
        {count > 1 ? (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className="absolute left-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-surface/90 text-fg shadow-card backdrop-blur hover:bg-surface">
              <ChevronLeftIcon />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Next photo" className="absolute right-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-surface/90 text-fg shadow-card backdrop-blur hover:bg-surface">
              <ChevronRightIcon />
            </button>
            <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
              {index + 1} / {count}
            </span>
          </>
        ) : null}
      </div>

      {count > 1 ? (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Photo thumbnails">
          {photos.map((p, i) => (
            <li key={p.full} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === index}
                className={`block overflow-hidden rounded-lg border-2 transition ${i === index ? "border-accent" : "border-transparent opacity-75 hover:opacity-100"}`}
              >
                <ResizedImage src={p.thumb} fallback={p.full} alt="" loading="lazy" className="h-16 w-24 object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-[90] flex flex-col bg-black/95" role="dialog" aria-modal="true" aria-label={`${alt} photos`}>
          <div className="flex items-center justify-between p-3 text-white">
            <span className="text-sm">{index + 1} / {count}</span>
            <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label="Close" className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10">
              <XIcon />
            </button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
            <img src={photos[index].full} alt={`${alt} – photo ${index + 1}`} className="max-h-full max-w-full object-contain" />
            {count > 1 ? (
              <>
                <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className="absolute left-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">
                  <ChevronLeftIcon />
                </button>
                <button type="button" onClick={() => go(1)} aria-label="Next photo" className="absolute right-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">
                  <ChevronRightIcon />
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
