import { NextResponse } from 'next/server'
import { getSetting } from '@/lib/serverSettings'
import { getServerUser } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const REQUIRED = [
  { key: 'ANTHROPIC_API_KEY', label: 'Anthropic API Key' },
  { key: 'DEEPGRAM_API_KEY', label: 'Deepgram API Key' },
]

// Not required but worth warning about — without it the raw Deepgram key is sent to the browser
const OPTIONAL_WARN = [
  { key: 'DEEPGRAM_PROJECT_ID', label: 'Deepgram Project ID (recommended for key security)' },
]

export async function GET() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ ok: false, missing: [] })

  const missing: string[] = []
  for (const { key, label } of REQUIRED) {
    const val = await getSetting(key, undefined, user.id)
    if (!val) missing.push(label)
  }

  const warnings: string[] = []
  for (const { key, label } of OPTIONAL_WARN) {
    const val = await getSetting(key, undefined, user.id)
    if (!val) warnings.push(label)
  }

  return NextResponse.json({ ok: missing.length === 0, missing, warnings })
}
