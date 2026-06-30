import { createClient } from '@supabase/supabase-js'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Looks up a key for a specific user first, then falls back to the env var.
// Pass userId whenever a user context is available (all authed routes).
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
