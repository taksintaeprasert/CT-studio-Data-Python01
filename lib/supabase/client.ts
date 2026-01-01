import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // During build time, env vars may not be available - use placeholder values
  // This is safe because the actual client is only used at runtime in the browser
  if (!supabaseUrl || !supabaseAnonKey) {
    // Return a dummy client for build-time that won't be used
    return createBrowserClient<Database>(
      'https://placeholder.supabase.co',
      'placeholder-key'
    )
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
}
