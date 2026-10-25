/** Message from anything thrown (Error, Supabase/PostgREST error object, string). */
export function errorMessage(e: unknown, fallback = "Something went wrong.") {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === "string" && e) return e;
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return fallback;
}
