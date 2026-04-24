import { createClient, SupabaseClient } from "@supabase/supabase-js";

type LooseTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

type Database = {
  public: {
    Tables: Record<string, LooseTable>;
    Views: Record<string, never>;
    Functions: Record<
      string,
      {
        Args: Record<string, unknown>;
        Returns: unknown;
      }
    >;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

let cachedClient: SupabaseClient<Database> | undefined;

function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
}

export function hasSupabaseConfig(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseServerKey());
}

function getSupabaseServerKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
}

export function getSupabaseAdmin() {
  if (cachedClient) return cachedClient;

  const supabaseUrl = getSupabaseUrl();
  const serviceRole = getSupabaseServerKey();

  if (!supabaseUrl || !serviceRole) {
    throw new Error("Missing Supabase server environment variables");
  }

  cachedClient = createClient<Database>(supabaseUrl, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  return cachedClient;
}
