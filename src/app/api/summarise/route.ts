import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { transcript, brief } = await request.json()

  if (!transcript?.trim()) return NextResponse.json({ summary: '' })

  const briefContext = brief ? `\n\nHackathon context: ${brief}` : ''

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    temperature: 0.3,
    system: `You are summarising a hackathon pitch in real-time for the judging panel.${briefContext}

Write 2–3 tight sentences covering: what the product does, who it's for, and the core technical approach. Be specific and factual — only reference what has actually been said.`,
    messages: [
      {
        role: 'user',
        content: transcript.slice(-3000),
      },
    ],
  })

  const content = message.content[0]
  const summary = content.type === 'text' ? content.text : ''

  return NextResponse.json({ summary })
}
