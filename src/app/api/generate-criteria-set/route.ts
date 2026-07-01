import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSetting } from '@/lib/serverSettings'
import { getServerUser } from '@/lib/supabase-server'
import { rateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!rateLimit(user.id, 'generate-criteria-set', 5000)) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
  }

  const { brief } = await request.json()
  if (!brief?.trim()) return NextResponse.json({ error: 'Brief required' }, { status: 400 })

  const anthropicKey = await getSetting('ANTHROPIC_API_KEY', undefined, user.id)
  if (!anthropicKey) return NextResponse.json({ error: 'No Anthropic API key configured — add it in Admin → Settings' }, { status: 400 })

  let text = ''
  try {
    const anthropic = new Anthropic({ apiKey: anthropicKey })
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      temperature: 0.4,
      system: `You generate scoring criteria for structured evaluation sessions. Given a description of what's being evaluated, produce 4–6 specific, useful criteria.

Return ONLY valid JSON — no markdown, no preamble:
{
  "criteria": [
    {
      "name": "2–3 word label",
      "description": "2–3 sentences telling the judge exactly what to look for and how to separate high scores from low ones. Be concrete.",
      "weight": 1
    }
  ]
}

Weight must be one of: 0.5, 1, 1.5, 2. Use 1.5–2 for the most important criteria, 0.5 for secondary ones.`,
      messages: [{ role: 'user', content: `Generate scoring criteria for:\n\n${brief.trim()}` }],
    })
    text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  } catch (e: any) {
    const msg = e?.message ?? 'Anthropic API error'
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  // Strip markdown code fences if the model wrapped the JSON anyway
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()

  try {
    const parsed = JSON.parse(stripped)
    if (!Array.isArray(parsed.criteria) || parsed.criteria.length === 0) throw new Error('Invalid format')
    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response', raw: stripped }, { status: 500 })
  }
}
