// Server-side presenter transition: detects (or manually triggers) a switch to the next presenter,
// creates the team row, and updates sessions.active_team_id atomically.
// Moving this server-side prevents multiple clients from racing to create duplicate teams.
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { getSetting } from '@/lib/serverSettings'
import { getServerUser } from '@/lib/supabase-server'
import { rateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ transition: false }, { status: 401 })

  if (!rateLimit(user.id, 'auto-transition', 3000)) {
    return NextResponse.json({ transition: false, error: 'Rate limited' }, { status: 429 })
  }

  const { sessionId, recentTranscript, manual } = await request.json()
  if (!sessionId) return NextResponse.json({ transition: false }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Verify ownership before doing any writes
  const { data: session } = await supabase
    .from('sessions').select('id').eq('id', sessionId).eq('user_id', user.id).single()
  if (!session) return NextResponse.json({ transition: false }, { status: 404 })

  const { count } = await supabase
    .from('teams').select('*', { count: 'exact', head: true }).eq('session_id', sessionId)
  const nextNumber = (count ?? 0) + 1

  let detectedName: string | null = null

  if (!manual && recentTranscript?.trim()) {
    const anthropicKey = await getSetting('ANTHROPIC_API_KEY', undefined, user.id)
    if (!anthropicKey) return NextResponse.json({ transition: false })

    const anthropic = new Anthropic({ apiKey: anthropicKey })
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 128,
        temperature: 0,
        system: `You detect when a new presenter has stepped up. Signs: applause, "thank you", "next up", "please welcome", a new group starting to introduce themselves. Return ONLY JSON — no other text: {"transition":true,"name":"<short name or null>"} or {"transition":false}`,
        messages: [{ role: 'user', content: `Recent transcript:\n\n${recentTranscript.slice(-1500)}` }],
      })
      const raw = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : '{}'
      const jsonText = raw.startsWith('```') ? raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim() : raw
      const parsed = JSON.parse(jsonText)
      if (!parsed.transition) return NextResponse.json({ transition: false })
      detectedName = parsed.name ?? null
    } catch {
      return NextResponse.json({ transition: false })
    }
  }

  const newName = detectedName?.trim() || `Session ${nextNumber}`

  const { data: newTeam, error } = await supabase
    .from('teams')
    .insert({ session_id: sessionId, name: newName, order_index: nextNumber - 1 })
    .select()
    .single()

  if (error || !newTeam) {
    console.error('[auto-transition] Failed to create team:', error)
    return NextResponse.json({ transition: false })
  }

  await supabase.from('sessions').update({ active_team_id: newTeam.id }).eq('id', sessionId)

  return NextResponse.json({ transition: true, team: newTeam })
}
