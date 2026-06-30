import { NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function POST(request: Request) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const { transcript, brief } = await request.json()

  if (!transcript?.trim()) return NextResponse.json({ summary: '' })

  const briefContext = brief
    ? `\n\nHackathon context: ${brief}`
    : ''

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.4,
    max_tokens: 180,
    messages: [
      {
        role: 'system',
        content: `You are summarising a hackathon pitch in real-time for the judging panel.${briefContext}

Write 2–3 tight sentences covering: what the product does, who it's for, and the core technical approach. Be specific and factual — only reference what has actually been said.`,
      },
      {
        role: 'user',
        content: transcript.slice(-3000),
      },
    ],
  })

  return NextResponse.json({ summary: completion.choices[0].message.content })
}
