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
      const [, summaryRes] = await Promise.allSettled([
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

      if (tokenData.error) throw new Error(`Deepgram token error: ${tokenData.error}`)
      const key: string = tokenData.key
      if (!key) throw new Error('Deepgram token missing from response')

      streamRef.current = stream

      // DeepgramClient constructor takes an options object — NOT a plain string
      const { DeepgramClient } = await import('@deepgram/sdk')
      const dg = new DeepgramClient({ apiKey: key })

      const conn = await dg.listen.v1.connect({
        model: 'nova-2' as any,
        language: 'en-US' as any,
        smart_format: true as any,
        interim_results: true as any,
        endpointing: 300 as any,
        Authorization: `Token ${key}`,
      })
      connectionRef.current = conn

      conn.on('open', () => {
        setConnecting(false)
        setRecording(true)

        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : ''

        const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
        mr.ondataavailable = (e) => {
          if (e.data.size > 0 && conn.readyState === 1) conn.sendMedia(e.data)
        }
        mr.start(250)
        mediaRecorderRef.current = mr

        timerRef.current = setInterval(runCycle, 15_000)
      })

      conn.on('message', (message: any) => {
        if (message?.type !== 'Results') return
        const alt = message?.channel?.alternatives?.[0]
        if (!alt?.transcript?.trim()) return
        if (message.is_final) {
          appendTranscript(alt.transcript)
          bufferRef.current += ' ' + alt.transcript

          // Write to transcript_chunks so the display page ticker updates
          const { activeTeam: team, session: sess } = useAppStore.getState()
          if (team && sess) {
            createSupabaseClient()
              .from('transcript_chunks')
              .insert({ session_id: sess.id, team_id: team.id, content: alt.transcript })
              .then(() => {})
          }
        }
      })

      conn.on('error', (e: any) => {
        console.error('Deepgram error:', e)
        useAppStore.getState().setConnecting(false)
        useAppStore.getState().setRecording(false)
      })

      conn.on('close', () => useAppStore.getState().setRecording(false))

      // Must call connect() to actually open the WebSocket and bind the event handlers
      conn.connect()
    } catch (e) {
      console.error('Start recording error:', e)
      useAppStore.getState().setConnecting(false)
    }
  }, [runCycle])

  const stop = useCallback(async () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    mediaRecorderRef.current?.stop()
    try { connectionRef.current?.sendCloseStream({}) } catch (_) {}
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
