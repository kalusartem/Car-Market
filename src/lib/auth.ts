import { supabase } from "./supabase";

export async function fetchAuthUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user ?? null;
}
