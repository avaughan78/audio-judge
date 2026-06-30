// Manual score override endpoint — lets judges correct an AI score directly.
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServerUser } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sessionId, teamId, criteriaId, score, reasoning } = await request.json()

  if (!sessionId || !teamId || !criteriaId || typeof score !== 'number') {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const clamped = Math.max(0, Math.min(100, Math.round(score)))

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Verify the session belongs to the authenticated user
  const { data: sessionRow } = await supabase
    .from('sessions').select('id').eq('id', sessionId).eq('user_id', user.id).single()
  if (!sessionRow) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  const { error } = await supabase.from('scores').upsert(
    {
      session_id: sessionId,
      team_id: teamId,
      criteria_id: criteriaId,
      score: clamped,
      reasoning: reasoning ?? 'Manual override',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'team_id,criteria_id' }
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, score: clamped })
}
