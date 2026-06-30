import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
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

  const briefContext = brief
    ? `\n\nHackathon brief / context:\n${brief}`
    : ''

  const criteriaBlock = criteria
    .map((c) => `- ${c.name} (ID: ${c.id}, weight: ${c.weight}): ${c.description || 'No description'}`)
    .join('\n')

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content: `You are an expert hackathon judge scoring a team's live pitch.${briefContext}

Score the team on EACH criterion from 0 to 100 based solely on what has been said in the transcript so far. Be specific — reference actual things mentioned in the pitch to justify scores. Do not award high scores for things not yet mentioned.

Criteria:
${criteriaBlock}

Return ONLY valid JSON in this exact format — no extra fields:
{
  "scores": [
    {
      "criteria_id": "<uuid>",
      "score": <integer 0-100>,
      "reasoning": "<one clear sentence citing specific evidence from the transcript>"
    }
  ]
}`,
      },
      {
        role: 'user',
        content: `Transcript so far:\n\n${transcript.slice(-4000)}`,
      },
    ],
  })

  const result = JSON.parse(completion.choices[0].message.content!)

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
