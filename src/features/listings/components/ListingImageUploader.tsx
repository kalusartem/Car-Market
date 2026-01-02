import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../../lib/supabase";

type ExistingImage = {
  id: string;
  bucket: string;
  path: string;
  position: number;
};

type Props = {
  listingId: string; // must exist already
  existingImages?: ExistingImage[]; // optional: if editing
  onUploaded?: () => void; // optional: callback to refetch
};

const BUCKET = "project-images";

function getFileExt(filename: string) {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "jpg";
}

function safeImageExt(ext: string) {
  // keep it simple; Storage cares less, but this helps consistency
  const allowed = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
  return allowed.has(ext) ? ext : "jpg";
}

function buildObjectPath(listingId: string, ext: string) {
  // Example: listings/<listing-id>/<random>.jpg
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `listings/${listingId}/${id}.${ext}`;
}

export function ListingImageUploader({
  listingId,
  existingImages = [],
  onUploaded,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const qc = useQueryClient();

  const [selected, setSelected] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const existingSorted = useMemo(() => {
    return [...existingImages].sort((a, b) => a.position - b.position);
  }, [existingImages]);

  const previews = useMemo(() => {
    return selected.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
    // NOTE: we clean up URLs below in an effect-like pattern when selection changes
  }, [selected]);

  // Cleanup object URLs when selection changes/unmounts
  // (simple pattern without useEffect to keep it compact)
  const prevUrlsRef = useRef<string[]>([]);
  if (prevUrlsRef.current.length) {
    for (const u of prevUrlsRef.current) URL.revokeObjectURL(u);
  }
  prevUrlsRef.current = previews.map((p) => p.url);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!listingId) throw new Error("listingId is required");
      if (selected.length === 0) return;

      setErrorMsg(null);
      setBusy(true);

      // compute starting position based on existing images
      const startPos =
        existingSorted.length > 0
          ? Math.max(...existingSorted.map((img) => img.position)) + 1
          : 0;

      // 1) upload files
      const uploadedRows: Array<{
        bucket: string;
        path: string;
        position: number;
      }> = [];

      for (let i = 0; i < selected.length; i++) {
        const file = selected[i];
        const ext = safeImageExt(getFileExt(file.name));
        const path = buildObjectPath(listingId, ext);

        // You can optionally set cacheControl; upsert false is safer
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type || undefined,
          });

        if (uploadError) {
          throw uploadError;
        }

        uploadedRows.push({
          bucket: BUCKET,
          path,
          position: startPos + i,
        });
      }

      // 2) insert rows into listing_images
      const payload = uploadedRows.map((r) => ({
        listing_id: listingId,
        bucket: r.bucket,
        path: r.path,
        position: r.position,
      }));

      const { error: insertError } = await supabase
        .from("listing_images")
        .insert(payload);

      if (insertError) {
        // Optional: rollback uploaded files (best-effort)
        try {
          await supabase.storage
            .from(BUCKET)
            .remove(uploadedRows.map((r) => r.path));
        } catch {
          // ignore rollback errors
        }
        throw insertError;
      }

      // 3) clear selection
      setSelected([]);
    },
    onSuccess: async () => {
      // If you have a query like ["listing", id] or ["listing-images", id], refetch it
      await qc.invalidateQueries({ queryKey: ["listing", listingId] });
      await qc.invalidateQueries({ queryKey: ["listing-images", listingId] });
      onUploaded?.();
    },
    onError: (err: any) => {
      setErrorMsg(err?.message ?? "Upload failed");
    },
    onSettled: () => {
      setBusy(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (img: ExistingImage) => {
      // 1) delete db row first (or storage first; either is fine)
      const { error: dbErr } = await supabase
        .from("listing_images")
        .delete()
        .eq("id", img.id);

      if (dbErr) throw dbErr;

      // 2) delete file from storage (best-effort)
      const { error: stErr } = await supabase.storage
        .from(img.bucket)
        .remove([img.path]);
      if (stErr) {
        // not fatal, but surface it if you want
        console.warn("Storage delete failed:", stErr.message);
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["listing", listingId] });
      await qc.invalidateQueries({ queryKey: ["listing-images", listingId] });
      onUploaded?.();
    },
  });

  const onPick = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files);

    // basic validation
    const filtered = arr.filter((f) => f.type.startsWith("image/"));
    setSelected((prev) => [...prev, ...filtered]);
  };

  const removeSelected = (index: number) => {
    setSelected((prev) => prev.filter((_, i) => i !== index));
  };

  const publicUrl = (bucket: string, path: string) => {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-semibold">Images</h3>
          <p className="text-sm text-slate-400 mt-1">
            Upload multiple images (JPG/PNG/WebP). Stored in Supabase Storage.
          </p>
        </div>

        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => onPick(e.target.files)}
          />

          <button
            type="button"
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            Add images
          </button>

          <button
            type="button"
            className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
            disabled={busy || selected.length === 0}
            onClick={() => uploadMutation.mutate()}
          >
            Upload {selected.length ? `(${selected.length})` : ""}
          </button>
        </div>
      </div>

      {errorMsg ? (
        <div className="mt-3 text-sm text-red-300">{errorMsg}</div>
      ) : null}

      {/* Existing images */}
      {existingSorted.length > 0 ? (
        <div className="mt-4">
          <div className="text-sm text-slate-300 mb-2">Current images</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {existingSorted.map((img) => {
              const url = publicUrl(img.bucket, img.path);
              return (
                <div key={img.id} className="relative group">
                  <img
                    src={url}
                    alt="Listing"
                    className="w-full h-32 object-cover rounded-xl border border-slate-800"
                  />
                  <button
                    type="button"
                    className="absolute top-2 right-2 px-2 py-1 text-xs rounded bg-black/60 hover:bg-black/80 opacity-0 group-hover:opacity-100 transition"
                    onClick={() => deleteMutation.mutate(img)}
                    disabled={deleteMutation.isPending}
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-4 text-sm text-slate-400">No images yet.</div>
      )}

      {/* Selected images to upload */}
      {selected.length > 0 ? (
        <div className="mt-5">
          <div className="text-sm text-slate-300 mb-2">
            Ready to upload
            {busy ? (
              <span className="text-slate-400"> • Uploading…</span>
            ) : null}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {previews.map((p, idx) => (
              <div key={p.url} className="relative group">
                <img
                  src={p.url}
                  alt={p.file.name}
                  className="w-full h-32 object-cover rounded-xl border border-slate-800"
                />
                <button
                  type="button"
                  className="absolute top-2 right-2 px-2 py-1 text-xs rounded bg-black/60 hover:bg-black/80 opacity-0 group-hover:opacity-100 transition"
                  onClick={() => removeSelected(idx)}
                  disabled={busy}
                  title="Remove from upload"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
