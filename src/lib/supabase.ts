import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: localStorage,
  },
});

/**
 * Transforms a storage path/ID into a public URL
 */
export const getCarImageUrl = (imageId: string | undefined) => {
  if (!imageId) {
    return "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800";
  }

  const { data } = supabase.storage.from("car-images").getPublicUrl(imageId);
  return data.publicUrl;
};
