import { NextResponse } from 'next/server'

export async function GET() {
  const projectId = process.env.DEEPGRAM_PROJECT_ID
  const apiKey = process.env.DEEPGRAM_API_KEY

  if (!projectId || !apiKey) {
    return NextResponse.json({ error: 'Deepgram credentials not configured' }, { status: 500 })
  }

  try {
    const res = await fetch(
      `https://api.deepgram.com/v1/projects/${projectId}/keys`,
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comment: 'audio-judge temporary key',
          scopes: ['usage:write'],
          time_to_live_in_seconds: 120,
        }),
      }
    )

    const data = await res.json()
    if (!res.ok) throw new Error(data.err_msg || 'Failed to create Deepgram key')

    return NextResponse.json({ key: data.key })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
