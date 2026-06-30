import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { maskValue } from '@/lib/serverSettings'
import { getServerUser } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const MANAGED_KEYS = [
  { key: 'ANTHROPIC_API_KEY', label: 'Anthropic API Key', hint: 'console.anthropic.com', envVar: 'ANTHROPIC_API_KEY' },
  { key: 'DEEPGRAM_API_KEY', label: 'Deepgram API Key', hint: 'console.deepgram.com', envVar: 'DEEPGRAM_API_KEY' },
  { key: 'DEEPGRAM_PROJECT_ID', label: 'Deepgram Project ID', hint: 'Optional — enables short-lived keys', envVar: 'DEEPGRAM_PROJECT_ID' },
]

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = serviceClient()
  const { data: rows } = await supabase
    .from('settings')
    .select('key, value, updated_at')
    .eq('user_id', user.id)

  const dbMap: Record<string, { value: string; updated_at: string }> = {}
  for (const row of rows ?? []) dbMap[row.key] = row

  const result = MANAGED_KEYS.map(({ key, label, hint, envVar }) => {
    const dbRow = dbMap[key]
    const envValue = process.env[envVar]
    const value = dbRow?.value || envValue || ''
    return {
      key,
      label,
      hint,
      isSet: !!value,
      source: dbRow ? 'db' : envValue ? 'env' : 'unset',
      preview: value ? maskValue(value) : '',
      updatedAt: dbRow?.updated_at ?? null,
    }
  })

  return NextResponse.json({ settings: result })
}

export async function POST(request: Request) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { key, value } = await request.json()

  const allowed = MANAGED_KEYS.map((k) => k.key)
  if (!allowed.includes(key)) {
    return NextResponse.json({ error: 'Unknown key' }, { status: 400 })
  }

  const supabase = serviceClient()

  if (!value?.trim()) {
    await supabase.from('settings').delete().eq('key', key).eq('user_id', user.id)
    return NextResponse.json({ ok: true, action: 'deleted' })
  }

  const { error } = await supabase.from('settings').upsert(
    { key, value: value.trim(), user_id: user.id, updated_at: new Date().toISOString() },
    { onConflict: 'key,user_id' }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, action: 'saved' })
}
