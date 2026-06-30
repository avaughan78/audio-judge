import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Server — used in Route Handlers only (never imported by client components)
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // ignore — throws in middleware context
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
