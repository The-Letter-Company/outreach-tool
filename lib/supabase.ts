import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Server-only Supabase client.
 *
 * Uses the service-role key, which bypasses Row Level Security — it must NEVER
 * be imported into client components or exposed to the browser. All database
 * access in this app goes through route handlers (`app/api/*`) and scripts,
 * both of which run on the server, so the client never talks to Supabase
 * directly and no anon key / RLS policy is needed.
 *
 * The client is created lazily so that importing this module never throws at
 * build time when env vars are absent.
 */
let _client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (_client) return _client

  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local'
    )
  }

  _client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return _client
}
