import { useEffect, useMemo } from "react";

type Props = {
  files: File[];
  onChange: (files: File[]) => void;
};

export function ListingImagePicker({ files, onChange }: Props) {
  const previews = useMemo(
    () =>
      files.map((f) => ({
        file: f,
        url: URL.createObjectURL(f),
      })),
    [files],
  );

  // cleanup object urls
  useEffect(() => {
    return () => previews.forEach((p) => URL.revokeObjectURL(p.url));
  }, [previews]);

  const onPick = (list: FileList | null) => {
    if (!list) return;
    const arr = Array.from(list).filter((f) => f.type.startsWith("image/"));
    onChange([...files, ...arr]);
  };

  const removeAt = (idx: number) => {
    onChange(files.filter((_, i) => i !== idx));
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= files.length) return;
    const next = [...files];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onChange(next);
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="font-medium">Photos</div>
          <div className="text-sm text-subtle">
            Add images now; they’ll upload when you save the listing.
          </div>
        </div>

        <label className="btn-secondary cursor-pointer">
          Add images
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => onPick(e.target.files)}
          />
        </label>
      </div>

      {previews.length ? (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {previews.map((p, idx) => (
            <div key={idx} className="rounded-xl border border-line p-2">
              <img
                src={p.url}
                className="w-full h-32 object-cover rounded-lg"
                alt=""
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="text-xs text-subtle">
                  {idx === 0 ? "Cover" : `#${idx + 1}`}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-xs px-2 py-1 rounded bg-surface-2 hover:bg-surface-3"
                    onClick={() => move(idx, idx - 1)}
                    disabled={idx === 0}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="text-xs px-2 py-1 rounded bg-surface-2 hover:bg-surface-3"
                    onClick={() => move(idx, idx + 1)}
                    disabled={idx === previews.length - 1}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="text-xs px-2 py-1 rounded bg-danger-solid hover:opacity-90 text-fg"
                    onClick={() => removeAt(idx)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 text-sm text-subtle">No images selected.</div>
      )}
    </div>
  );
}
