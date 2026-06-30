import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { transcript, teamId, sessionId, brief } = await request.json()

  if (!transcript?.trim()) {
    return NextResponse.json({ error: 'No transcript provided' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: criteria } = await supabase
    .from('criteria')
    .select('*')
    .eq('session_id', sessionId)
    .order('order_index')

  if (!criteria?.length) {
    return NextResponse.json({ error: 'No criteria configured for this session' }, { status: 400 })
  }

  const briefContext = brief ? `\n\nHackathon brief / context:\n${brief}` : ''
  const criteriaBlock = criteria
    .map((c) => `- ${c.name} (ID: ${c.id}, weight: ${c.weight}): ${c.description || 'No description'}`)
    .join('\n')

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    temperature: 0.2,
    system: `You are an expert hackathon judge scoring a team's live pitch.${briefContext}

Score the team on EACH criterion from 0 to 100 based solely on what has been said in the transcript so far. Be specific — reference actual things mentioned in the pitch to justify scores. Do not award high scores for things not yet mentioned.

Criteria:
${criteriaBlock}

Return ONLY valid JSON in this exact format — no extra fields, no markdown:
{
  "scores": [
    {
      "criteria_id": "<uuid>",
      "score": <integer 0-100>,
      "reasoning": "<one clear sentence citing specific evidence from the transcript>"
    }
  ]
}`,
    messages: [
      {
        role: 'user',
        content: `Transcript so far:\n\n${transcript.slice(-4000)}`,
      },
    ],
  })

  const content = message.content[0]
  if (content.type !== 'text') {
    return NextResponse.json({ error: 'Unexpected response from AI' }, { status: 500 })
  }

  const result = JSON.parse(content.text)

  await supabase.from('scores').upsert(
    result.scores.map((s: any) => ({
      session_id: sessionId,
      team_id: teamId,
      criteria_id: s.criteria_id,
      score: Math.max(0, Math.min(100, Math.round(s.score))),
      reasoning: s.reasoning,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: 'team_id,criteria_id' }
  )

  return NextResponse.json({ success: true })
}
