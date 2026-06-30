import { NextResponse } from 'next/server'
import { getSetting } from '@/lib/serverSettings'
import { getServerUser } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const apiKey = await getSetting('DEEPGRAM_API_KEY', undefined, user.id)
  const projectId = await getSetting('DEEPGRAM_PROJECT_ID', undefined, user.id)

  if (!apiKey) {
    return NextResponse.json({ error: 'DEEPGRAM_API_KEY not configured' }, { status: 500 })
  }

  // Preferred path: exchange the stored key for a short-lived (5 min) scoped key.
  // The raw key never reaches the browser. Requires DEEPGRAM_PROJECT_ID to be set.
  if (projectId) {
    try {
      const res = await fetch(`https://api.deepgram.com/v1/projects/${projectId}/keys`, {
        method: 'POST',
        headers: { Authorization: `Token ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comment: 'audiojudge-live-session',
          scopes: ['usage:write'],
          time_to_live_in_seconds: 300,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        return NextResponse.json({ key: data.key })
      }
    } catch {
      // fall through to the raw-key fallback
    }
  }

  // Fallback when no project ID is configured: send the raw API key to the browser.
  // This works but means the key is visible in browser devtools. Set DEEPGRAM_PROJECT_ID
  // in .env.local to use scoped keys instead.
  return NextResponse.json({ key: apiKey })
}
