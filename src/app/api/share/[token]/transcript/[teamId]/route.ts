import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string; teamId: string }> }
) {
  const { token, teamId } = await params

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Verify the token is valid and the team belongs to that session
  const { data: session } = await supabase
    .from('sessions')
    .select('id')
    .eq('share_token', token)
    .single()

  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: chunks } = await supabase
    .from('transcript_chunks')
    .select('content')
    .eq('session_id', session.id)
    .eq('team_id', teamId)
    .order('timestamp', { ascending: true })

  return NextResponse.json({ transcript: chunks?.map((c: any) => c.content).join(' ') ?? '' })
}
