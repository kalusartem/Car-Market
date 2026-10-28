// src/features/listings/components/ListingForm.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../../lib/supabase";
import { lookupZip } from "../../../lib/location";
import { imageUrl as publicImageUrl } from "../../../lib/images";
import { useExtendedSpecs, useListingReview } from "../../../lib/features";
import { requestReviewEmail } from "../../../lib/review";
import type { Listing } from "../../../types/car";
import { useMakes, useModels } from "../../../hooks/useVehicleData";
import { fetchComps } from "../../../lib/comps";
import { formatPrice } from "../../../lib/format";
import { summarizeComps } from "../../../lib/priceCheck";
import {
  BODY_TYPES,
  COLORS,
  CURRENT_YEAR,
  DRIVETRAINS,
  FUEL_TYPES,
  MIN_YEAR,
  TITLE_STATUSES,
  TRANSMISSIONS,
} from "../../../lib/specs";
import {
  decodeVin,
  isValidVinFormat,
  normalizeVin,
} from "../../../lib/vehicle";

type Mode = "create" | "edit";

export type ListingRow = {
  id: string;
  seller_id: string;

  make: string;
  model: string;
  year: number;
  price: number;
  mileage: number;

  fuel_type: string;
  transmission: string;

  description: string | null;
  is_active: boolean | null;

  zip_code?: string | null;
  lat?: number | null;
  lng?: number | null;

  vin?: string | null;
  trim?: string | null;
  body_type?: string | null;
  drivetrain?: string | null;
  exterior_color?: string | null;
  title_status?: string | null;

  created_at?: string;
};

type ListingImageRow = {
  id: string;
  listing_id: string;
  bucket: string;
  path: string;
  position: number;
};

type Props = {
  mode: Mode;
  listingId?: string; // required for edit
  initial?: Partial<ListingRow>; // initial listing fields (edit)
  onCreated?: (listingId: string) => void;
  onSaved?: () => void;
};

type FormState = {
  vin: string;
  trim: string;
  body_type: string;
  drivetrain: string;
  exterior_color: string;
  title_status: string;
  make: string;
  model: string;
  zip_code: string;
  year: string;
  price: string;
  mileage: string;
  fuel_type: string;
  transmission: string;
  description: string;
  is_active: boolean;
};

const BUCKET = "car-images";

// Keep these aligned with your UI promise (JPG/PNG/WebP)
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp"]);

function toStr(v: unknown) {
  return v === null || v === undefined ? "" : String(v);
}

function isIntString(s: string) {
  return /^[0-9]+$/.test(s.trim());
}

function isNumberString(s: string) {
  return /^[0-9]+(\.[0-9]+)?$/.test(s.trim());
}

function getFileExt(filename: string) {
  const i = filename.lastIndexOf(".");
  if (i < 0) return "jpg";
  return filename.slice(i + 1).toLowerCase();
}

function safeImageExt(ext: string) {
  return ALLOWED_EXT.has(ext) ? ext : "jpg";
}

function uuidLike(): string {
  // Browser-safe UUID
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildObjectPath(listingId: string, ext: string) {
  // IMPORTANT: keep a consistent prefix so Storage RLS can match it
  return `listings/${listingId}/${uuidLike()}.${ext}`;
}

const publicUrl = publicImageUrl;

async function fetchListingImages(listingId: string) {
  const { data, error } = await supabase
    .from("listing_images")
    .select("id, listing_id, bucket, path, position")
    .eq("listing_id", listingId)
    .order("position", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ListingImageRow[];
}

async function removeStorageObjects(bucket: string, paths: string[]) {
  if (!paths.length) return;
  const { error } = await supabase.storage.from(bucket).remove(paths);
  if (error) throw error;
}

async function deleteListingImageRows(ids: string[]) {
  if (!ids.length) return;
  const { error } = await supabase
    .from("listing_images")
    .delete()
    .in("id", ids);
  if (error) throw error;
}

async function updateImagePositions(
  rows: Array<{ id: string; position: number }>,
) {
  if (!rows.length) return;

  // If your schema allows, you can do an upsert; otherwise update one-by-one.
  // Upsert usually requires a unique constraint; safe fallback: individual updates.
  for (const r of rows) {
    const { error } = await supabase
      .from("listing_images")
      .update({ position: r.position })
      .eq("id", r.id);
    if (error) throw error;
  }
}

async function uploadFilesAndInsertRows(
  listingId: string,
  files: File[],
  startPosition: number,
) {
  if (!files.length) return;

  const inserted: Array<{ bucket: string; path: string; position: number }> =
    [];

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const ext = safeImageExt(getFileExt(f.name));
    const path = buildObjectPath(listingId, ext);

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, f, {
        cacheControl: "3600",
        upsert: false,
        contentType: f.type || undefined,
      });

    if (uploadErr) throw uploadErr;

    inserted.push({ bucket: BUCKET, path, position: startPosition + i });
  }

  const payload = inserted.map((r) => ({
    listing_id: listingId,
    bucket: r.bucket,
    path: r.path,
    position: r.position,
  }));

  const { error: insertErr } = await supabase
    .from("listing_images")
    .insert(payload);
  if (insertErr) {
    // best-effort rollback storage
    try {
      await removeStorageObjects(
        BUCKET,
        inserted.map((x) => x.path),
      );
    } catch {
      // ignore rollback errors
    }
    throw insertErr;
  }
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs text-subtle mb-1">{label}</div>
      {children}
    </div>
  );
}

export function ListingForm({
  mode,
  listingId,
  initial,
  onCreated,
  onSaved,
}: Props) {
  const qc = useQueryClient();
  const isEdit = mode === "edit";

  const defaults: FormState = useMemo(
    () => ({
      vin: toStr(initial?.vin),
      trim: toStr(initial?.trim),
      body_type: toStr(initial?.body_type),
      drivetrain: toStr(initial?.drivetrain),
      exterior_color: toStr(initial?.exterior_color),
      title_status: toStr(initial?.title_status),
      make: toStr(initial?.make),
      model: toStr(initial?.model),
      zip_code: toStr(initial?.zip_code),
      year: toStr(initial?.year),
      price: toStr(initial?.price),
      mileage: toStr(initial?.mileage),
      fuel_type: toStr(initial?.fuel_type),
      transmission: toStr(initial?.transmission),
      description: toStr(initial?.description),
      is_active: initial?.is_active ?? true,
    }),
    // re-init when switching listing
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initial?.id],
  );

  const [form, setForm] = useState<FormState>(defaults);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  // Images state:
  // - existingImages: DB rows from listing_images
  // - deletedImageIds: track which existing images the user removed
  // - pendingFiles: new files selected but not uploaded yet (uploaded on Save)
  const [existingImages, setExistingImages] = useState<ListingImageRow[]>([]);
  const [deletedImageIds, setDeletedImageIds] = useState<Set<string>>(
    new Set(),
  );
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  useEffect(() => {
    setForm(defaults);
  }, [defaults]);

  // Load existing images in edit mode
  const imagesQuery = useQuery({
    queryKey: ["listing-images", listingId],
    queryFn: () => fetchListingImages(listingId!),
    enabled: isEdit && !!listingId,
  });

  useEffect(() => {
    if (imagesQuery.data) {
      setExistingImages(imagesQuery.data);
      setDeletedImageIds(new Set());
    }
  }, [imagesQuery.data]);

  const extended = useExtendedSpecs();
  const review = useListingReview();
  const { makes, isLoading: makesLoading, failed: makesFailed } = useMakes();
  const yearNum = Number(form.year);
  const yearValid = Number.isInteger(yearNum) && yearNum >= MIN_YEAR && yearNum <= CURRENT_YEAR + 1;
  const { models, isLoading: modelsLoading } = useModels(form.make, yearValid ? yearNum : undefined);

  const [vinStatus, setVinStatus] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "ok"; message: string }
    | { kind: "warn"; message: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const runVinDecode = async () => {
    const vin = normalizeVin(form.vin);
    if (!isValidVinFormat(vin)) {
      setVinStatus({
        kind: "error",
        message: "A VIN is 17 characters (letters and digits, no I, O or Q).",
      });
      return;
    }
    setVinStatus({ kind: "loading" });
    try {
      const d = await decodeVin(vin);
      if (!d) {
        setVinStatus({ kind: "error", message: "We couldn’t decode that VIN. You can still fill in the details by hand." });
        return;
      }
      setForm((f) => ({
        ...f,
        vin: d.vin,
        year: d.year ? String(d.year) : f.year,
        make: d.make || f.make,
        model: d.model || f.model,
        trim: d.trim || f.trim,
        body_type: d.bodyType || f.body_type,
        drivetrain: d.drivetrain || f.drivetrain,
        fuel_type: d.fuelType || f.fuel_type,
        transmission: d.transmission || f.transmission,
      }));
      const summary = [d.year, d.make, d.model, d.trim].filter(Boolean).join(" ");
      setVinStatus(
        d.checkDigitOk
          ? { kind: "ok", message: `Filled in from VIN: ${summary}${d.engine ? ` · ${d.engine}` : ""}. Check the details below.` }
          : { kind: "warn", message: `Filled in from VIN: ${summary}. The VIN’s check digit doesn’t match — double-check that you typed it correctly.` },
      );
    } catch {
      setVinStatus({ kind: "error", message: "VIN lookup is unavailable right now. You can still fill in the details by hand." });
    }
  };

  // Live "what do similar cars cost" hint for the seller.
  const comps = useQuery({
    queryKey: ["form-comps", form.make.toLowerCase(), form.model.toLowerCase(), yearNum, listingId ?? null],
    enabled: !!form.make.trim() && !!form.model.trim() && yearValid,
    staleTime: 60_000,
    queryFn: () => fetchComps({ make: form.make.trim(), model: form.model.trim(), year: yearNum, excludeId: listingId }),
  });
  const priceHint = comps.data
    ? summarizeComps(comps.data, { mileage: isIntString(form.mileage) ? Number(form.mileage) : null })
    : null;

  const visibleExisting = useMemo(
    () => existingImages.filter((img) => !deletedImageIds.has(img.id)),
    [existingImages, deletedImageIds],
  );

  const previewPending = useMemo(
    () =>
      pendingFiles.map((f) => ({
        file: f,
        url: URL.createObjectURL(f),
      })),
    [pendingFiles],
  );

  useEffect(() => {
    return () => previewPending.forEach((p) => URL.revokeObjectURL(p.url));
  }, [previewPending]);

  const validate = (): string | null => {
    if (!form.make.trim()) return "Make is required.";
    if (!form.model.trim()) return "Model is required.";
    if (!form.year.trim() || !isIntString(form.year))
      return "Year must be a whole number.";
    if (!form.price.trim() || !isNumberString(form.price))
      return "Price must be a number.";
    if (!form.mileage.trim() || !isIntString(form.mileage))
      return "Mileage must be a whole number.";
    if (yearNum < MIN_YEAR || yearNum > CURRENT_YEAR + 1)
      return `Year must be between ${MIN_YEAR} and ${CURRENT_YEAR + 1}.`;
    if (extended && form.vin.trim() && !isValidVinFormat(normalizeVin(form.vin)))
      return "VIN must be 17 characters (no I, O or Q), or leave it blank.";
    if (!form.fuel_type.trim()) return "Fuel type is required.";
    if (!form.transmission.trim()) return "Transmission is required.";
    if (isEdit && !listingId) return "Missing listing id for edit.";
    return null;
  };

  const pickFiles = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list).filter((f) => ALLOWED_MIME.has(f.type));
    if (!incoming.length) {
      setErrorMsg("Please select JPG, PNG, or WebP images.");
      return;
    }
    setErrorMsg(null);
    setPendingFiles((prev) => [...prev, ...incoming]);
  };

  const removePendingAt = (idx: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const movePending = (from: number, to: number) => {
    setPendingFiles((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [it] = next.splice(from, 1);
      next.splice(to, 0, it);
      return next;
    });
  };

  const markExistingDeleted = (id: string) => {
    setDeletedImageIds((prev) => new Set(prev).add(id));
  };

  const moveExisting = (from: number, to: number) => {
    setExistingImages((prev) => {
      // reorder across the full array, but preserve "deleted" flags
      const visibleIdxs = prev
        .map((x, i) => ({ x, i }))
        .filter(({ x }) => !deletedImageIds.has(x.id))
        .map(({ i }) => i);

      if (from < 0 || from >= visibleIdxs.length) return prev;
      if (to < 0 || to >= visibleIdxs.length) return prev;

      const fromIdx = visibleIdxs[from];
      const toIdx = visibleIdxs[to];

      const next = [...prev];
      const [it] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, it);
      return next;
    });
  };

  /** After a save, a pending listing (new, or edited enough to need another look) emails the admin. */
  const reviewStatusAfterSave = async (id: string) => {
    if (!review) return null;
    const { data } = await supabase.from("listings").select("*").eq("id", id).maybeSingle();
    const status = (data as Listing | null)?.status ?? null;
    if (status === "pending") void requestReviewEmail(id);
    return status;
  };

  const mutation = useMutation({
    mutationFn: async () => {
      setErrorMsg(null);
      setSavedMsg(null);

      const v = validate();
      if (v) throw new Error(v);

      // Listing payload
      // Location: store ZIP + precomputed lat/lng for fast radius search
      const zip = form.zip_code.trim();
      const ll = zip ? await lookupZip(zip) : null;
      if (zip && !ll)
        throw new Error("We couldn’t find that ZIP code. Check it, or clear the field.");

      const specs = extended
        ? {
            vin: form.vin.trim() ? normalizeVin(form.vin) : null,
            trim: form.trim.trim() || null,
            body_type: form.body_type || null,
            drivetrain: form.drivetrain || null,
            exterior_color: form.exterior_color || null,
            title_status: form.title_status || null,
            city: ll?.city ?? null,
            state: ll?.state ?? null,
          }
        : {};

      const payload = {
        ...specs,
        make: form.make.trim(),
        model: form.model.trim(),
        zip_code: zip || null,
        lat: ll?.lat ?? null,
        lng: ll?.lng ?? null,
        year: Number(form.year),
        price: Number(form.price),
        mileage: Number(form.mileage),
        fuel_type: form.fuel_type.trim(),
        transmission: form.transmission.trim(),
        description: form.description.trim() ? form.description.trim() : null,
        is_active: form.is_active,
      };

      if (!isEdit) {
        // Create
        const { data: userRes, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        const user = userRes.user;
        if (!user)
          throw new Error("You must be logged in to create a listing.");

        const seller_id = user.id;

        const { data, error } = await supabase
          .from("listings")
          .insert({ ...payload, seller_id })
          .select("id")
          .single();

        if (error) throw error;

        const newId = data.id as string;

        // Upload selected images (cover = position 0)
        if (pendingFiles.length) {
          await uploadFilesAndInsertRows(newId, pendingFiles, 0);
        }

        return { id: newId, mode: "create" as const, status: await reviewStatusAfterSave(newId) };
      }

      // Edit
      // 1) Update listing
      const { error: upErr } = await supabase
        .from("listings")
        .update(payload)
        .eq("id", listingId!);
      if (upErr) throw upErr;

      // 2) Delete removed existing images (DB + storage)
      const deletedIds = Array.from(deletedImageIds);
      if (deletedIds.length) {
        const toDelete = existingImages.filter((x) =>
          deletedImageIds.has(x.id),
        );
        // delete rows first or storage first — either is fine; this is safer for UI consistency
        await deleteListingImageRows(deletedIds);
        // best-effort storage cleanup (won't block if policies aren’t in place, but throws if it fails)
        const paths = toDelete
          .filter((x) => x.bucket === BUCKET)
          .map((x) => x.path);
        if (paths.length) await removeStorageObjects(BUCKET, paths);
      }

      // 3) Recompute positions for remaining existing images (visibleExisting order)
      // Note: existingImages state may include deleted; we compute the current visible order by position in array
      const remaining = existingImages.filter(
        (x) => !deletedImageIds.has(x.id),
      );
      // Ensure stable order as currently displayed (array order)
      const positionUpdates = remaining.map((img, idx) => ({
        id: img.id,
        position: idx,
      }));
      await updateImagePositions(positionUpdates);

      // 4) Upload pending files and append after existing images
      const startPos = remaining.length;
      if (pendingFiles.length) {
        await uploadFilesAndInsertRows(listingId!, pendingFiles, startPos);
      }

      return { id: listingId!, mode: "edit" as const, status: await reviewStatusAfterSave(listingId!) };
    },
    onSuccess: async (res) => {
      // clear local image state
      setPendingFiles([]);
      setDeletedImageIds(new Set());
      if (res.mode === "edit") {
        setSavedMsg(
          res.status === "pending"
            ? "Saved. An admin will review the changes before they go live."
            : "Saved.",
        );
      }

      // refresh cache
      await qc.invalidateQueries({ queryKey: ["listing-images", res.id] });
      await qc.invalidateQueries({ queryKey: ["listing-edit", res.id] });
      await qc.invalidateQueries({ queryKey: ["my-listings"] });
      await qc.invalidateQueries({ queryKey: ["listing", res.id] });
      await qc.invalidateQueries({ queryKey: ["review-queue"] });

      if (res.mode === "create") onCreated?.(res.id);
      else onSaved?.();
    },
    onError: (err: unknown) => {
      const e = err as { code?: string; message?: string } | null;
      if (e?.code === "23505" && /vin/i.test(e.message ?? "")) {
        setErrorMsg("An active listing with this VIN already exists.");
        return;
      }
      setErrorMsg(e?.message ?? "Save failed.");
    },
  });

  const existingDisplay = useMemo(() => {
    const imgs = visibleExisting;
    // display order is state order; cover is index 0
    return imgs.map((img, idx) => ({
      ...img,
      idx,
      url: publicUrl(img.bucket, img.path),
      label: idx === 0 ? "Cover" : `#${idx + 1}`,
    }));
  }, [visibleExisting]);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="rounded-2xl border border-line bg-surface p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">
              {isEdit ? "Edit Listing" : "Create Listing"}
            </h1>
            <p className="text-sm text-subtle mt-1">
              {isEdit
                ? "Update details and manage images."
                : "Enter details, choose images, then save."}
            </p>
          </div>

          <button
            type="button"
            className="btn-primary"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Saving…" : "Save"}
          </button>
        </div>

        {errorMsg ? (
          <div className="mt-4 text-sm text-danger">{errorMsg}</div>
        ) : null}
        {savedMsg ? (
          <div role="status" className="mt-4 text-sm text-success">{savedMsg}</div>
        ) : null}
        {review ? (
          <p className="mt-4 text-sm text-subtle">
            Listings appear in the marketplace once an admin approves them. Changing the details or adding
            photos sends a listing back for review.
          </p>
        ) : null}

        <div className="mt-6 rounded-xl border border-line bg-surface-2 p-4">
          <label htmlFor="vin" className="text-sm font-semibold">Start with the VIN (optional)</label>
          <p className="mt-0.5 text-xs text-subtle">
            We’ll fill in year, make, model, trim and specs from NHTSA’s database.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              id="vin"
              className="input min-w-[16rem] flex-1 font-mono uppercase tracking-wider"
              value={form.vin}
              maxLength={20}
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="17-character VIN"
              onChange={(e) => {
                setForm({ ...form, vin: e.target.value });
                if (vinStatus.kind !== "idle") setVinStatus({ kind: "idle" });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void runVinDecode();
                }
              }}
            />
            <button
              type="button"
              className="btn-secondary"
              disabled={vinStatus.kind === "loading" || !form.vin.trim()}
              onClick={() => void runVinDecode()}
            >
              {vinStatus.kind === "loading" ? "Decoding…" : "Decode VIN"}
            </button>
          </div>
          {vinStatus.kind === "ok" ? (
            <p role="status" className="mt-2 text-sm text-success">{vinStatus.message}</p>
          ) : vinStatus.kind === "warn" ? (
            <p role="status" className="mt-2 text-sm text-warn">{vinStatus.message}</p>
          ) : vinStatus.kind === "error" ? (
            <p role="alert" className="mt-2 text-sm text-danger">{vinStatus.message}</p>
          ) : null}
          {!extended && form.vin.trim() ? (
            <p className="mt-2 text-xs text-subtle">The VIN fills in the form but isn’t saved until the database update is applied.</p>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Year">
            <input
              className="input"
              value={form.year}
              onChange={(e) => setForm({ ...form, year: e.target.value.replace(/\D/g, "").slice(0, 4), model: "" })}
              inputMode="numeric"
              placeholder={`e.g., ${CURRENT_YEAR - 5}`}
            />
          </Field>

          <Field label="Make">
            {makesFailed ? (
              <input className="input" value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} placeholder="e.g., Toyota" />
            ) : (
              <select
                className="input"
                value={form.make}
                disabled={makesLoading}
                onChange={(e) => setForm({ ...form, make: e.target.value, model: "" })}
              >
                <option value="">{makesLoading ? "Loading makes…" : "Select…"}</option>
                {form.make && ![...makes.popular, ...makes.all].some((m) => m.toLowerCase() === form.make.toLowerCase()) ? (
                  <option value={form.make}>{form.make}</option>
                ) : null}
                <optgroup label="Popular">
                  {makes.popular.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </optgroup>
                {makes.all.length ? (
                  <optgroup label="All makes">
                    {makes.all.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
            )}
          </Field>

          <Field label="Model">
            {models.length || modelsLoading ? (
              <select
                className="input"
                value={form.model}
                disabled={!form.make || modelsLoading}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
              >
                <option value="">{!form.make ? "Choose a make first" : modelsLoading ? "Loading models…" : "Select…"}</option>
                {form.model && !models.some((m) => m.toLowerCase() === form.model.toLowerCase()) ? (
                  <option value={form.model}>{form.model}</option>
                ) : null}
                {models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            ) : (
              <input className="input" value={form.model} disabled={!form.make} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder={form.make ? "e.g., Camry" : "Choose a make first"} />
            )}
          </Field>

          {extended ? (
            <Field label="Trim (optional)">
              <input className="input" value={form.trim} onChange={(e) => setForm({ ...form, trim: e.target.value })} placeholder="e.g., SE, Sport, Limited" />
            </Field>
          ) : null}

          <Field label="Price">
            <input
              className="input"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              inputMode="decimal"
              placeholder="e.g., 18500"
            />
            {priceHint ? (
              <p className="mt-1 text-xs text-subtle">
                Similar cars on Car Market are listed for {formatPrice(priceHint.low)}–{formatPrice(priceHint.high)}{" "}
                (median {formatPrice(priceHint.median)}, {priceHint.count} listings).
              </p>
            ) : comps.isSuccess ? (
              <p className="mt-1 text-xs text-subtle">Not enough similar listings yet for a price suggestion.</p>
            ) : null}
          </Field>

          <Field label="Mileage">
            <input
              className="input"
              value={form.mileage}
              onChange={(e) => setForm({ ...form, mileage: e.target.value })}
              inputMode="numeric"
              placeholder="e.g., 65000"
            />
          </Field>

          <Field label="ZIP Code">
            <input
              className="input"
              value={form.zip_code}
              onChange={(e) => setForm({ ...form, zip_code: e.target.value.replace(/\D/g, "").slice(0, 5) })}
              inputMode="numeric"
              placeholder="e.g., 10001"
            />
          </Field>

          {extended ? (
            <Field label="Body type">
              <select className="input" value={form.body_type} onChange={(e) => setForm({ ...form, body_type: e.target.value })}>
                <option value="">Select…</option>
                {BODY_TYPES.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </Field>
          ) : null}

          <Field label="Fuel Type">
            <select className="input" value={form.fuel_type} onChange={(e) => setForm({ ...form, fuel_type: e.target.value })}>
              <option value="">Select…</option>
              {FUEL_TYPES.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </Field>

          <Field label="Transmission">
            <select className="input" value={form.transmission} onChange={(e) => setForm({ ...form, transmission: e.target.value })}>
              <option value="">Select…</option>
              {TRANSMISSIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </Field>

          {extended ? (
            <>
              <Field label="Drivetrain">
                <select className="input" value={form.drivetrain} onChange={(e) => setForm({ ...form, drivetrain: e.target.value })}>
                  <option value="">Select…</option>
                  {DRIVETRAINS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </Field>
              <Field label="Exterior color">
                <select className="input" value={form.exterior_color} onChange={(e) => setForm({ ...form, exterior_color: e.target.value })}>
                  <option value="">Select…</option>
                  {COLORS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </Field>
              <Field label="Title status">
                <select className="input" value={form.title_status} onChange={(e) => setForm({ ...form, title_status: e.target.value })}>
                  <option value="">Select…</option>
                  {TITLE_STATUSES.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </Field>
            </>
          ) : null}

          <Field label="Active">
            <label className="flex items-center gap-2 text-fg">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              Visible in marketplace
            </label>
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Description (optional)">
            <textarea
              className="input min-h-[120px]"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Condition, recent service, features, known issues..."
            />
          </Field>
        </div>

        {/* Images */}
        <div className="mt-6 rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="font-medium">Images</div>
              <div className="text-sm text-subtle">
                JPG/PNG/WebP only. Images upload when you click{" "}
                <span className="text-fg">Save</span>.
              </div>
            </div>

            <label className="btn-secondary cursor-pointer">
              Add images
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => pickFiles(e.target.files)}
              />
            </label>
          </div>

          {/* Existing images (edit) */}
          {isEdit ? (
            <div className="mt-4">
              {imagesQuery.isLoading ? (
                <div className="text-sm text-subtle">Loading images…</div>
              ) : existingDisplay.length ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {existingDisplay.map((img, idx) => (
                    <div
                      key={img.id}
                      className="rounded-xl border border-line p-2"
                    >
                      <img
                        src={img.url}
                        className="w-full h-32 object-cover rounded-lg"
                        alt=""
                      />
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="text-xs text-subtle">
                          {img.label}
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="text-xs px-2 py-1 rounded bg-surface-2 hover:bg-surface-3 disabled:opacity-50"
                            onClick={() => moveExisting(idx, idx - 1)}
                            disabled={idx === 0}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="text-xs px-2 py-1 rounded bg-surface-2 hover:bg-surface-3 disabled:opacity-50"
                            onClick={() => moveExisting(idx, idx + 1)}
                            disabled={idx === existingDisplay.length - 1}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className="text-xs px-2 py-1 rounded bg-danger-solid hover:opacity-90 text-fg"
                            onClick={() => markExistingDeleted(img.id)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-subtle">No images yet.</div>
              )}
            </div>
          ) : null}

          {/* Pending uploads */}
          <div className="mt-4">
            {previewPending.length ? (
              <>
                <div className="text-sm text-muted mb-2">
                  Ready to upload ({previewPending.length})
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {previewPending.map((p, idx) => (
                    <div
                      key={`${p.file.name}-${idx}`}
                      className="rounded-xl border border-line p-2"
                    >
                      <img
                        src={p.url}
                        className="w-full h-32 object-cover rounded-lg"
                        alt=""
                      />
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="text-xs text-subtle">
                          {idx === 0 && !isEdit && !existingDisplay.length
                            ? "Cover"
                            : `+${idx + 1}`}
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="text-xs px-2 py-1 rounded bg-surface-2 hover:bg-surface-3 disabled:opacity-50"
                            onClick={() => movePending(idx, idx - 1)}
                            disabled={idx === 0}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="text-xs px-2 py-1 rounded bg-surface-2 hover:bg-surface-3 disabled:opacity-50"
                            onClick={() => movePending(idx, idx + 1)}
                            disabled={idx === previewPending.length - 1}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className="text-xs px-2 py-1 rounded bg-danger-solid hover:opacity-90 text-fg"
                            onClick={() => removePendingAt(idx)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <div className="mt-1 text-[11px] text-subtle truncate">
                        {p.file.name}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-xs text-subtle">
                  Tip: the first image becomes the cover (after
                  deletions/reorder), then the rest follow.
                </div>
              </>
            ) : (
              <div className="text-sm text-subtle">
                No new images selected.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
