import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * Null when env vars are absent — the app then runs entirely on bundled seed data
 * and localStorage, which keeps local development and demos zero-config.
 */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null
export const isSupabaseEnabled = supabase !== null
