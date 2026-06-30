import { createClient } from '@supabase/supabase-js'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Looks up a per-user API key from the database. The envFallback parameter exists
// for flexibility but is intentionally never passed from authed routes — each user
// must supply their own keys; the host's env vars must not silently substitute.
export async function getSetting(key: string, envFallback?: string, userId?: string): Promise<string | undefined> {
  if (userId) {
    try {
      const { data } = await serviceClient()
        .from('settings')
        .select('value')
        .eq('key', key)
        .eq('user_id', userId)
        .single()
      if (data?.value) return data.value
    } catch {
      // fall through
    }
  }
  return envFallback || undefined
}

export function maskValue(value: string): string {
  if (value.length <= 8) return '••••••••'
  return value.slice(0, 8) + '•'.repeat(Math.min(value.length - 8, 24))
}
