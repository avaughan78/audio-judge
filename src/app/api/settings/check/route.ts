import { NextResponse } from 'next/server'
import { getSetting } from '@/lib/serverSettings'
import { getServerUser } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const REQUIRED = [
  { key: 'ANTHROPIC_API_KEY', label: 'Anthropic API Key' },
  { key: 'DEEPGRAM_API_KEY', label: 'Deepgram API Key' },
]

export async function GET() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ ok: false, missing: [] })

  const missing: string[] = []
  for (const { key, label } of REQUIRED) {
    const val = await getSetting(key, undefined, user.id)
    if (!val) missing.push(label)
  }

  return NextResponse.json({ ok: missing.length === 0, missing })
}
