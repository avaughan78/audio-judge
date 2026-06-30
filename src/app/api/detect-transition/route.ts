import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSetting } from '@/lib/serverSettings'
import { getServerUser } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const user = await getServerUser()
    if (!user) return NextResponse.json({ transition: false })

    const { recentTranscript } = await request.json()

    if (!recentTranscript?.trim()) {
      return NextResponse.json({ transition: false })
    }

    const anthropicKey = await getSetting('ANTHROPIC_API_KEY', process.env.ANTHROPIC_API_KEY, user.id)
    if (!anthropicKey) return NextResponse.json({ transition: false })

    const anthropic = new Anthropic({ apiKey: anthropicKey })

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 128,
      temperature: 0,
      system: `You detect when a new presenter/team has stepped up at an event. Signs of a transition include: applause, "thank you", "next up", "please welcome", "our next team", or a new group of people starting to introduce themselves with a clearly different topic or name than before.

Return ONLY valid JSON, no other text:
{"transition": true, "name": "<short name extracted from intro, or null if unclear>"}
or
{"transition": false}`,
      messages: [
        {
          role: 'user',
          content: `Recent transcript (last ~60 seconds):\n\n${recentTranscript.slice(-1500)}`,
        },
      ],
    })

    const raw = message.content[0]?.type === 'text' ? message.content[0].text.trim() : '{}'
    const jsonText = raw.startsWith('```') ? raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim() : raw

    let result: { transition: boolean; name?: string | null }
    try {
      result = JSON.parse(jsonText)
    } catch {
      return NextResponse.json({ transition: false })
    }

    return NextResponse.json({ transition: !!result.transition, name: result.name ?? null })
  } catch (err: any) {
    console.error('[detect-transition] Error:', err)
    return NextResponse.json({ transition: false })
  }
}
