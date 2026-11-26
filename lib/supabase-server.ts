import { createClient } from "@supabase/supabase-js";
import type { Session } from "./types";

function getServerSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });
}

export async function fetchSessionsServer(): Promise<{
  sessions: Session[];
  error: string | null;
}> {
  const client = getServerSupabaseClient();
  if (!client) {
    return {
      sessions: [],
      error: "Konfigurasi Supabase belum tersedia di server.",
    };
  }

  try {
    const { data, error } = await client
      .from("sessions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return { sessions: [], error: error.message };
    }

    return { sessions: (data || []) as Session[], error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gagal terhubung ke Supabase.";
    return { sessions: [], error: message };
  }
}

export async function fetchSessionByIdServer(id: number): Promise<{
  session: Session | null;
  notFound: boolean;
  error: string | null;
}> {
  if (!Number.isInteger(id) || id <= 0) {
    return { session: null, notFound: true, error: null };
  }

  const client = getServerSupabaseClient();
  if (!client) {
    return {
      session: null,
      notFound: false,
      error: "Konfigurasi Supabase belum tersedia di server.",
    };
  }

  try {
    const { data, error } = await client
      .from("sessions")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return { session: null, notFound: false, error: error.message };
    }

    if (!data) {
      return { session: null, notFound: true, error: null };
    }

    return { session: data as Session, notFound: false, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gagal memuat data sesi.";
    return { session: null, notFound: false, error: message };
  }
}

export async function fetchSessionSitemapEntries(): Promise<
  Array<{ id: number; created_at?: string | null }>
> {
  const client = getServerSupabaseClient();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from("sessions")
      .select("id,created_at")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error || !data) return [];
    return data as Array<{ id: number; created_at?: string | null }>;
  } catch {
    return [];
  }
}
