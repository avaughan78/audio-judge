import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { transcript, teamId, sessionId, brief } = await request.json()

    if (!transcript?.trim()) {
      return NextResponse.json({ error: 'No transcript provided' }, { status: 400 })
    }
    if (!teamId || !sessionId) {
      return NextResponse.json({ error: 'Missing teamId or sessionId' }, { status: 400 })
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, { status: 500 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: criteria, error: criteriaErr } = await supabase
      .from('criteria')
      .select('*')
      .eq('session_id', sessionId)
      .order('order_index')

    if (criteriaErr) {
      return NextResponse.json({ error: `DB error fetching criteria: ${criteriaErr.message}` }, { status: 500 })
    }
    if (!criteria?.length) {
      return NextResponse.json({ error: 'No criteria configured for this session' }, { status: 400 })
    }

    const briefContext = brief ? `\n\nContext / evaluation brief:\n${brief}` : ''
    const criteriaBlock = criteria
      .map((c) => `- ${c.name} (ID: ${c.id}, weight: ${c.weight}): ${c.description || 'No description'}`)
      .join('\n')

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      temperature: 0.2,
      system: `You are an expert evaluator scoring a live presentation in real time.${briefContext}

Score the presenter on EACH criterion from 0 to 100 based solely on what has been said in the transcript so far. Be specific — reference actual things mentioned in the presentation to justify scores. Only score what has been demonstrated; do not speculate about things not yet said.

Criteria:
${criteriaBlock}

Return ONLY valid JSON in this exact format — no markdown, no code fences, no extra text:
{"scores":[{"criteria_id":"<uuid>","score":<integer 0-100>,"reasoning":"<one clear sentence>"}]}`,
      messages: [
        {
          role: 'user',
          content: `Transcript so far:\n\n${transcript.slice(-4000)}`,
        },
      ],
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      return NextResponse.json({ error: 'Unexpected response type from AI' }, { status: 500 })
    }

    // Strip markdown code fences if Claude wraps the JSON
    const rawText = content.text.trim()
    const jsonText = rawText.startsWith('```')
      ? rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
      : rawText

    let result: { scores: Array<{ criteria_id: string; score: number; reasoning: string }> }
    try {
      result = JSON.parse(jsonText)
    } catch (parseErr) {
      console.error('[judge] JSON parse failed. Raw text:', rawText)
      return NextResponse.json({ error: 'AI returned invalid JSON', raw: rawText.slice(0, 200) }, { status: 500 })
    }

    if (!Array.isArray(result?.scores)) {
      return NextResponse.json({ error: 'AI response missing scores array' }, { status: 500 })
    }

    // Fetch existing scores so we only write if the new score is higher
    const { data: existing } = await supabase
      .from('scores')
      .select('criteria_id, score')
      .eq('team_id', teamId)

    const existingMap: Record<string, number> = {}
    for (const row of existing ?? []) existingMap[row.criteria_id] = row.score

    const toUpsert = result.scores
      .map((s) => ({ ...s, score: Math.max(0, Math.min(100, Math.round(s.score))) }))
      .filter((s) => s.score > (existingMap[s.criteria_id] ?? 0))

    if (toUpsert.length > 0) {
      const { error: upsertErr } = await supabase.from('scores').upsert(
        toUpsert.map((s) => ({
          session_id: sessionId,
          team_id: teamId,
          criteria_id: s.criteria_id,
          score: s.score,
          reasoning: s.reasoning,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'team_id,criteria_id' }
      )
      if (upsertErr) {
        console.error('[judge] Upsert error:', upsertErr)
        return NextResponse.json({ error: `DB upsert failed: ${upsertErr.message}` }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, updated: toUpsert.length, total: result.scores.length })
  } catch (err: any) {
    console.error('[judge] Unhandled error:', err)
    return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 })
  }
}
