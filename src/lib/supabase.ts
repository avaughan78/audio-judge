import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // Fallback to placeholder so build-time SSR doesn't throw; real requests require proper env vars at runtime
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key'
  )
}
