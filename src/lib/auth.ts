import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";

export async function fetchAuthUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user ?? null;
}

export function useAuthUser() {
  return useQuery({
    queryKey: ["auth-user"],
    queryFn: fetchAuthUser,
    staleTime: 30_000,
  });
}

/** Email sign-in needs a custom SMTP provider configured in Supabase to reach real
 *  users (the built-in sender is heavily rate-limited), so it is opt-in. */
export const EMAIL_LOGIN_ENABLED = import.meta.env.VITE_ENABLE_EMAIL_LOGIN === "true";

const RETURN_KEY = "returnTo";

export function rememberReturnTo(path: string) {
  try {
    sessionStorage.setItem(RETURN_KEY, path);
  } catch {
    // ignore: user lands on the home page after sign-in
  }
}

export function takeReturnTo(): string | null {
  try {
    const v = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    return v && v.startsWith("/") && !v.startsWith("//") ? v : null;
  } catch {
    return null;
  }
}

export type OAuthProvider = "google" | "github";

export async function signInWithProvider(provider: OAuthProvider, returnTo: string) {
  rememberReturnTo(returnTo);
  // Same-email identities (GitHub/Google) are linked to one user by Supabase.
  return supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.origin },
  });
}

export async function signInWithEmail(email: string, returnTo: string) {
  rememberReturnTo(returnTo);
  return supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
}
