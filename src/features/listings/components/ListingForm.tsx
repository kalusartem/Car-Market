import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "../../../lib/supabase";
import { ListingImageUploader } from "./ListingImageUploader";

export type ListingRow = {
  id: string;
  seller_id: string;
  make: string;
  model: string;
  year: number;
  price: number; // numeric from supabase may come as string; we normalize in form state
  mileage: number;
  fuel_type: string;
  transmission: string;
  description: string | null;
  is_active: boolean | null;
  created_at?: string;
};

type Mode = "create" | "edit";

type Props = {
  mode: Mode;
  initial?: Partial<ListingRow>; // for edit
  listingId?: string; // required in edit (and for uploader)
  showImages?: boolean; // show uploader in edit
  onCreated?: (listingId: string) => void;
  onSaved?: () => void;
};

type FormState = {
  make: string;
  model: string;
  year: string; // keep as string for inputs
  price: string;
  mileage: string;
  fuel_type: string;
  transmission: string;
  description: string;
  is_active: boolean;
};

function toStr(v: any) {
  return v === null || v === undefined ? "" : String(v);
}

function isIntString(s: string) {
  return /^[0-9]+$/.test(s.trim());
}

function isNumberString(s: string) {
  return /^[0-9]+(\.[0-9]+)?$/.test(s.trim());
}

export function ListingForm({
  mode,
  initial,
  listingId,
  showImages = false,
  onCreated,
  onSaved,
}: Props) {
  const defaults: FormState = useMemo(
    () => ({
      make: toStr(initial?.make),
      model: toStr(initial?.model),
      year: toStr(initial?.year),
      price: toStr(initial?.price),
      mileage: toStr(initial?.mileage),
      fuel_type: toStr(initial?.fuel_type),
      transmission: toStr(initial?.transmission),
      description: toStr(initial?.description),
      is_active: initial?.is_active ?? true,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initial?.id], // refresh defaults when switching listings
  );

  const [form, setForm] = useState<FormState>(defaults);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => setForm(defaults), [defaults]);

  const validate = (): string | null => {
    if (!form.make.trim()) return "Make is required.";
    if (!form.model.trim()) return "Model is required.";

    if (!form.year.trim()) return "Year is required.";
    if (!isIntString(form.year)) return "Year must be a whole number.";

    if (!form.price.trim()) return "Price is required.";
    if (!isNumberString(form.price)) return "Price must be a number.";

    if (!form.mileage.trim()) return "Mileage is required.";
    if (!isIntString(form.mileage)) return "Mileage must be a whole number.";

    if (!form.fuel_type.trim()) return "Fuel type is required.";
    if (!form.transmission.trim()) return "Transmission is required.";

    if (mode === "edit" && !listingId) return "Missing listing id for edit.";
    return null;
  };

  const mutation = useMutation({
    mutationFn: async () => {
      setErrorMsg(null);

      const v = validate();
      if (v) throw new Error(v);

      // Normalize numbers
      const payload = {
        make: form.make.trim(),
        model: form.model.trim(),
        year: Number(form.year),
        price: Number(form.price),
        mileage: Number(form.mileage),
        fuel_type: form.fuel_type.trim(),
        transmission: form.transmission.trim(),
        description: form.description.trim() ? form.description.trim() : null,
        is_active: form.is_active,
      };

      if (mode === "create") {
        const { data: userRes, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        if (!userRes?.user)
          throw new Error("You must be logged in to create a listing.");

        const seller_id = userRes.user.id;

        const { data, error } = await supabase
          .from("listings")
          .insert({ ...payload, seller_id })
          .select("id")
          .single();

        if (error) throw error;
        return { id: data.id as string, mode };
      }

      // edit
      const { error } = await supabase
        .from("listings")
        .update(payload)
        .eq("id", listingId!);

      if (error) throw error;
      return { id: listingId!, mode };
    },
    onSuccess: (res) => {
      if (res.mode === "create") onCreated?.(res.id);
      else onSaved?.();
    },
    onError: (err: any) => {
      setErrorMsg(err?.message ?? "Save failed.");
    },
  });

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">
              {mode === "create" ? "Create Listing" : "Edit Listing"}
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              {mode === "create"
                ? "Enter details first, then upload images."
                : "Update details and manage images."}
            </p>
          </div>

          <button
            type="button"
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Saving…" : "Save"}
          </button>
        </div>

        {errorMsg ? (
          <div className="mt-4 text-sm text-red-300">{errorMsg}</div>
        ) : null}

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Make">
            <input
              className="w-full bg-slate-800 rounded-lg px-3 py-2 text-white"
              value={form.make}
              onChange={(e) => setForm({ ...form, make: e.target.value })}
              placeholder="e.g., Toyota"
            />
          </Field>

          <Field label="Model">
            <input
              className="w-full bg-slate-800 rounded-lg px-3 py-2 text-white"
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              placeholder="e.g., Camry"
            />
          </Field>

          <Field label="Year">
            <input
              className="w-full bg-slate-800 rounded-lg px-3 py-2 text-white"
              value={form.year}
              onChange={(e) => setForm({ ...form, year: e.target.value })}
              inputMode="numeric"
              placeholder="e.g., 2020"
            />
          </Field>

          <Field label="Price">
            <input
              className="w-full bg-slate-800 rounded-lg px-3 py-2 text-white"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              inputMode="decimal"
              placeholder="e.g., 18500"
            />
          </Field>

          <Field label="Mileage">
            <input
              className="w-full bg-slate-800 rounded-lg px-3 py-2 text-white"
              value={form.mileage}
              onChange={(e) => setForm({ ...form, mileage: e.target.value })}
              inputMode="numeric"
              placeholder="e.g., 65000"
            />
          </Field>

          <Field label="Fuel Type">
            <select
              className="w-full bg-slate-800 rounded-lg px-3 py-2 text-white"
              value={form.fuel_type}
              onChange={(e) => setForm({ ...form, fuel_type: e.target.value })}
            >
              <option value="">Select…</option>
              <option value="Gasoline">Gasoline</option>
              <option value="Diesel">Diesel</option>
              <option value="Hybrid">Hybrid</option>
              <option value="Electric">Electric</option>
            </select>
          </Field>

          <Field label="Transmission">
            <select
              className="w-full bg-slate-800 rounded-lg px-3 py-2 text-white"
              value={form.transmission}
              onChange={(e) =>
                setForm({ ...form, transmission: e.target.value })
              }
            >
              <option value="">Select…</option>
              <option value="Automatic">Automatic</option>
              <option value="Manual">Manual</option>
              <option value="CVT">CVT</option>
              <option value="DCT">DCT</option>
            </select>
          </Field>

          <Field label="Active">
            <label className="flex items-center gap-2 text-slate-200">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) =>
                  setForm({ ...form, is_active: e.target.checked })
                }
              />
              Visible in marketplace
            </label>
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Description (optional)">
            <textarea
              className="w-full bg-slate-800 rounded-lg px-3 py-2 text-white min-h-[120px]"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Condition, recent service, features, known issues..."
            />
          </Field>
        </div>

        {/* Images: only show uploader in edit mode after listing exists */}
        {showImages && mode === "edit" && listingId ? (
          <div className="mt-6">
            <ListingImageUploader listingId={listingId} />
          </div>
        ) : mode === "create" ? (
          <div className="mt-6 text-sm text-slate-400">
            Create the listing first, then you’ll be able to upload images.
          </div>
        ) : null}
      </div>
    </div>
  );
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
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      {children}
    </div>
  );
}
