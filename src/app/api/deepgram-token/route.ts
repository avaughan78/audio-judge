import { NextResponse } from 'next/server'
import { getSetting } from '@/lib/serverSettings'
import { getServerUser } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const apiKey = await getSetting('DEEPGRAM_API_KEY', undefined, user.id)
  const projectId = await getSetting('DEEPGRAM_PROJECT_ID', undefined, user.id)

  if (!apiKey) {
    return NextResponse.json({ error: 'DEEPGRAM_API_KEY not configured' }, { status: 500 })
  }

  // Create a short-lived scoped key so the raw API key is never exposed to the browser
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
      // fall through to returning the main key
    }
  }

  // Fallback: return the main key (less secure, but works without a project ID)
  return NextResponse.json({ key: apiKey })
}
