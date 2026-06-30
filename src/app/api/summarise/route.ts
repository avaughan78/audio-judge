import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { getSetting } from '@/lib/serverSettings'
import { getServerUser } from '@/lib/supabase-server'
import { rateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ summary: '' })

  if (!rateLimit(user.id, 'summarise', 3000)) {
    return NextResponse.json({ summary: '' })
  }

  const { transcript, brief, teamId } = await request.json()

  if (!transcript?.trim()) return NextResponse.json({ summary: '' })

  // Verify the team belongs to a session owned by this user
  if (teamId && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data: team } = await supabase.from('teams').select('session_id').eq('id', teamId).single()
    if (team) {
      const { data: sess } = await supabase.from('sessions').select('id').eq('id', team.session_id).eq('user_id', user.id).single()
      if (!sess) return NextResponse.json({ summary: '' })
    }
  }

  const briefContext = brief ? `\n\nEvaluation context: ${brief}` : ''

  const anthropicKey = await getSetting('ANTHROPIC_API_KEY', undefined, user.id)
  if (!anthropicKey) return NextResponse.json({ summary: '' })

  const anthropic = new Anthropic({ apiKey: anthropicKey })

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    temperature: 0.3,
    system: `You are a real-time assistant summarising a live spoken presentation for an evaluation panel.${briefContext}

Write 2–3 tight sentences capturing the key points from what has been said so far. Be specific and factual — only reference what has actually been said in the transcript, even if it is brief or incomplete. Never refuse or ask for clarification — always produce a summary of whatever content is present.`,
    messages: [
      {
        role: 'user',
        content: transcript.slice(-3000),
      },
    ],
  })

  const content = message.content[0]
  const summary = content.type === 'text' ? content.text : ''

  if (summary && teamId && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    await supabase.from('teams').update({ summary }).eq('id', teamId)
  }

  return NextResponse.json({ summary })
}
