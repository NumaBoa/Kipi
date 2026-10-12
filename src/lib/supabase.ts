import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://geqldztzwjbkhajluibx.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlcWxkenR6d2pia2hhamx1aWJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMzE5NzAsImV4cCI6MjEwNjgwNzk3MH0.dqhM7RFUHPPeaDgEI4ycVg4h_oR25BBhPTkZm3aYiDM";

const supabaseUrl =
  (import.meta.env["VITE_SUPABASE_URL"] as string | undefined) ||
  DEFAULT_SUPABASE_URL;

const supabaseAnonKey =
  (import.meta.env["VITE_SUPABASE_ANON_KEY"] as string | undefined) ||
  DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith("http")
);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
