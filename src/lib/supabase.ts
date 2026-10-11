import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta.env["VITE_SUPABASE_URL"] as string | undefined) || "";
const supabaseAnonKey = (import.meta.env["VITE_SUPABASE_ANON_KEY"] as string | undefined) || "";

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== "https://seu-projeto.supabase.co" && 
  supabaseUrl.trim() !== ""
);

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-key"
);
