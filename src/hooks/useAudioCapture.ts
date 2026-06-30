'use client'

import { useRef, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { createClient as createSupabaseClient } from '@/lib/supabase'

export function useAudioCapture() {
  const connectionRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const bufferRef = useRef('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const runCycle = useCallback(async () => {
    const state = useAppStore.getState()
    const { activeTeam, session, setSummarising, setSummary, setLastJudgedAt } = state
    const transcript = bufferRef.current.trim()
    if (!transcript || !activeTeam || !session) return

    setSummarising(true)
    try {
      const [judgeRes, summaryRes] = await Promise.allSettled([
        fetch('/api/judge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript,
            teamId: activeTeam.id,
            sessionId: session.id,
            brief: session.brief,
          }),
        }),
        fetch('/api/summarise', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript, brief: session.brief }),
        }).then((r) => r.json()),
      ])

      if (summaryRes.status === 'fulfilled' && summaryRes.value?.summary) {
        setSummary(summaryRes.value.summary)
      }
      setLastJudgedAt(Date.now())
    } catch (e) {
      console.error('Judging cycle error:', e)
    } finally {
      setSummarising(false)
    }
  }, [])

  const start = useCallback(async () => {
    const { activeTeam, setConnecting, setRecording, appendTranscript } =
      useAppStore.getState()
    if (!activeTeam) return

    setConnecting(true)
    try {
      const [tokenData, stream] = await Promise.all([
        fetch('/api/deepgram-token').then((r) => r.json()),
        navigator.mediaDevices.getUserMedia({ audio: true, video: false }),
      ])

      if (tokenData.error) {
        throw new Error(`Deepgram token error: ${tokenData.error}`)
      }

      const key: string = tokenData.key
      if (!key) throw new Error('Deepgram token missing from response')

      streamRef.current = stream

      const { createClient: createDgClient, LiveTranscriptionEvents } = await import('@deepgram/sdk')
      const dg = createDgClient(key)

      const conn = dg.listen.live({
        model: 'nova-2',
        language: 'en-US',
        smart_format: true,
        interim_results: true,
        endpointing: 300,
      })
      connectionRef.current = conn

      conn.on(LiveTranscriptionEvents.Open, () => {
        setConnecting(false)
        setRecording(true)

        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : ''

        const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
        mr.ondataavailable = (e) => {
          if (e.data.size > 0 && conn.getReadyState() === 1) conn.send(e.data)
        }
        mr.start(250)
        mediaRecorderRef.current = mr

        timerRef.current = setInterval(runCycle, 15_000)
      })

      conn.on(LiveTranscriptionEvents.Transcript, (data: any) => {
        const alt = data?.channel?.alternatives?.[0]
        if (!alt?.transcript?.trim()) return
        if (data.is_final) {
          appendTranscript(alt.transcript)
          bufferRef.current += ' ' + alt.transcript

          // Write to transcript_chunks so the display page ticker works
          const { activeTeam: team, session: sess } = useAppStore.getState()
          if (team && sess) {
            const supabase = createSupabaseClient()
            supabase.from('transcript_chunks').insert({
              session_id: sess.id,
              team_id: team.id,
              content: alt.transcript,
            }).then(() => {})
          }
        }
      })

      conn.on(LiveTranscriptionEvents.Error, (e: any) => {
        console.error('Deepgram error:', e)
        useAppStore.getState().setConnecting(false)
        useAppStore.getState().setRecording(false)
      })

      conn.on(LiveTranscriptionEvents.Close, () => {
        useAppStore.getState().setRecording(false)
      })
    } catch (e) {
      console.error('Start recording error:', e)
      useAppStore.getState().setConnecting(false)
    }
  }, [runCycle])

  const stop = useCallback(async () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    mediaRecorderRef.current?.stop()
    try { connectionRef.current?.requestClose() } catch (_) {}
    streamRef.current?.getTracks().forEach((t) => t.stop())
    mediaRecorderRef.current = null
    connectionRef.current = null
    streamRef.current = null
    await runCycle()
    useAppStore.getState().setRecording(false)
    bufferRef.current = ''
  }, [runCycle])

  return { start, stop }
}
