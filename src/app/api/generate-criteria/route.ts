import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSetting } from '@/lib/serverSettings'
import { getServerUser } from '@/lib/supabase-server'
import { rateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!rateLimit(user.id, 'generate-criteria', 2000)) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
  }

  const { name, brief } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const anthropicKey = await getSetting('ANTHROPIC_API_KEY', undefined, user.id)
  if (!anthropicKey) return NextResponse.json({ error: 'No Anthropic API key set' }, { status: 400 })

  const anthropic = new Anthropic({ apiKey: anthropicKey })

  const briefContext = brief ? `\n\nEvaluation context: ${brief}` : ''

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 150,
    temperature: 0.4,
    system: `You write scoring guides for evaluation criteria used by an AI judge. Given a criterion name, write 2–3 sentences telling the judge exactly what to look for and how to differentiate high from low scores. Be concrete and specific. No preamble — output only the guide text.${briefContext}`,
    messages: [{ role: 'user', content: `Criterion: ${name.trim()}` }],
  })

  const content = message.content[0]
  const description = content.type === 'text' ? content.text.trim() : ''

  return NextResponse.json({ description })
}
