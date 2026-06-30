import { createBrowserClient, createServerClient as _createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Browser — used in client components and hooks
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'
  )
}

// Server — used in Route Handlers and middleware; reads/writes session cookies
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  return _createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // setAll throws in middleware; ignore — middleware handles it separately
          }
        },
      },
    }
  )
}

// Convenience: get the authenticated user from a Route Handler, or null
export async function getServerUser() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
