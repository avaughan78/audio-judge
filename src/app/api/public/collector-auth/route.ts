import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { code } = await req.json()
  if (!code?.trim()) return NextResponse.json({ error: 'Missing code' }, { status: 400 })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Validate the collector code
  const { data: profile } = await admin
    .from('user_profiles')
    .select('user_id')
    .eq('collector_code', code.trim().toUpperCase())
    .single()

  if (!profile) return NextResponse.json({ error: 'Invalid code' }, { status: 401 })

  // Sign in anonymously using the anon key (creates a real Supabase auth user)
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: anonData, error: anonError } = await anonClient.auth.signInAnonymously()
  if (anonError || !anonData.user || !anonData.session) {
    return NextResponse.json({ error: 'Anonymous auth failed — ensure it is enabled in Supabase' }, { status: 500 })
  }

  // Map the anonymous user to the workspace
  await admin.from('collector_sessions').upsert({
    anonymous_user_id: anonData.user.id,
    workspace_user_id: profile.user_id,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  })

  return NextResponse.json({ session: anonData.session })
}
