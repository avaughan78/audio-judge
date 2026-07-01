import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/supabase-server'

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = admin()
  // Ensure profile exists (handles race if trigger hasn't fired yet)
  await db.from('user_profiles').upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true })

  const { data } = await db.from('user_profiles').select('collector_code').eq('user_id', user.id).single()
  return NextResponse.json({ collector_code: data?.collector_code ?? null })
}

export async function POST() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Regenerate the collector code
  const db = admin()
  const newCode = Math.random().toString(36).slice(2, 6).toUpperCase() +
    Math.random().toString(36).slice(2, 6).toUpperCase()

  const { data } = await db
    .from('user_profiles')
    .update({ collector_code: newCode })
    .eq('user_id', user.id)
    .select('collector_code')
    .single()

  return NextResponse.json({ collector_code: data?.collector_code ?? null })
}
