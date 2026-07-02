import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: session } = await supabase
    .from('sessions')
    .select('id, name, brief, created_at')
    .eq('share_token', token)
    .single()

  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [{ data: teams }, { data: criteria }, { data: scores }] = await Promise.all([
    supabase.from('teams').select('id, name, summary, order_index, created_at').eq('session_id', session.id).order('order_index'),
    supabase.from('criteria').select('id, name, weight, description, order_index').eq('session_id', session.id).order('order_index'),
    supabase.from('scores').select('team_id, criteria_id, score, reasoning').eq('session_id', session.id),
  ])

  return NextResponse.json({ session, teams: teams ?? [], criteria: criteria ?? [], scores: scores ?? [] })
}
