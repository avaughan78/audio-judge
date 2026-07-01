'use client'

import { useRef, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { createClient as createSupabaseClient } from '@/lib/supabase'
import { getDeviceId } from '@/lib/deviceId'
import type { CaptureMode } from './useCollectorCapture'

const WORDS_PER_CYCLE = 40
const CYCLE_INTERVAL_MS = 12_000
const MAX_BUFFER_WORDS = 8_000

export function useAudioCapture(captureMode: CaptureMode = 'local') {
  const deviceId = useRef(getDeviceId())
  const connectionRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const bufferRef = useRef('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isJudgingRef = useRef(false)
  const wordCountAtLastJudgeRef = useRef(0)
  const stoppedRef = useRef(false)
  const collectorChannelRef = useRef<any>(null)

  const runCycle = useCallback(async (options?: { final?: boolean }) => {
    if (isJudgingRef.current) return
    const state = useAppStore.getState()
    const { activeTeam, session, setSummarising, setSummary, setLastJudgedAt, setJudgeError } = state
    const transcript = bufferRef.current.trim()
    if (!transcript || !activeTeam || !session) return

    isJudgingRef.current = true
    wordCountAtLastJudgeRef.current = transcript.split(/\s+/).filter(Boolean).length
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
            final: options?.final ?? false,
          }),
        }).then(async (r) => {
          const data = await r.json()
          if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`)
          return data
        }),
        fetch('/api/summarise', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript, brief: session.brief, teamId: activeTeam.id }),
        }).then((r) => r.json()),
      ])

      if (judgeRes.status === 'fulfilled') {
        setJudgeError(null)
      } else {
        console.error('[judge] API failed:', judgeRes.reason)
        setJudgeError(String(judgeRes.reason?.message ?? 'Scoring failed — check your API key'))
      }

      if (summaryRes.status === 'fulfilled' && summaryRes.value?.summary) {
        setSummary(summaryRes.value.summary)
      }
      setLastJudgedAt(Date.now())
    } catch (e: any) {
      console.error('[judge] Cycle error:', e)
      setJudgeError(e?.message ?? 'Scoring error')
    } finally {
      setSummarising(false)
      isJudgingRef.current = false
    }
  }, [])

  const clearBuffer = useCallback(() => {
    bufferRef.current = ''
    wordCountAtLastJudgeRef.current = 0
    try {
      sessionStorage.removeItem('aj_transcript_buffer')
      sessionStorage.removeItem('aj_transcript_team_id')
    } catch (_) {}
  }, [])

  const start = useCallback(async () => {
    const { setConnecting, setRecording, appendTranscript, setRecordingStartedAt, setActiveTeam } =
      useAppStore.getState()
    const { session } = useAppStore.getState()

    if (!session) return

    // Initiate media acquisition synchronously — getDisplayMedia must be called
    // within the user-activation window (the click), before any awaited fetches
    // that would expire it.
    const rawStreamPromise: Promise<MediaStream> = captureMode === 'online'
      ? navigator.mediaDevices.getDisplayMedia({ audio: true, video: true })
      : navigator.mediaDevices.getUserMedia({ audio: true, video: false })

    // Create fresh session slot — runs in parallel while the user is picking
    // a screen/tab in the browser's share picker
    const transitionRes = await fetch('/api/auto-transition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: session.id, manual: true }),
    })
    const transitionData = await transitionRes.json()
    if (!transitionData.transition || !transitionData.team) {
      rawStreamPromise.then(s => s.getTracks().forEach(t => t.stop())).catch(() => {})
      console.error('[audio] Failed to create session slot')
      return
    }
    setActiveTeam(transitionData.team)
    useAppStore.setState((s: any) => ({ teams: [...s.teams, transitionData.team] }))

    stoppedRef.current = false
    setConnecting(true)
    try {
      const [tokenData, rawStream] = await Promise.all([
        fetch('/api/deepgram-token').then((r) => r.json()),
        rawStreamPromise,
      ])

      if (tokenData.error) throw new Error(`Deepgram token error: ${tokenData.error}`)
      const key: string = tokenData.key
      if (!key) throw new Error('Deepgram token missing from response')

      let stream: MediaStream
      if (captureMode === 'online') {
        const audioTracks = rawStream.getAudioTracks()
        if (!audioTracks.length) {
          rawStream.getTracks().forEach((t) => t.stop())
          const msg = 'No audio captured — select a Chrome tab and tick "Share tab audio"'
          useAppStore.getState().setJudgeError(msg)
          throw new Error(msg)
        }
        // Use rawStream directly — new MediaStream(audioTracks) can silently break
        // the audio data pipeline for getDisplayMedia tracks in Chrome.
        // audio/webm mimeType ensures only audio is encoded even with video tracks present.
        stream = rawStream
        streamRef.current = rawStream
      } else {
        stream = rawStream
        streamRef.current = stream
      }

      const { DeepgramClient } = await import('@deepgram/sdk')
      const dg = new DeepgramClient({ apiKey: key })
      const supabase = createSupabaseClient()

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
        if (stoppedRef.current) return
        setConnecting(false)
        setRecording(true)
        if (mediaRecorderRef.current) return
        setRecordingStartedAt(Date.now())

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

        timerRef.current = setInterval(runCycle, CYCLE_INTERVAL_MS)

        // Subscribe to transcript chunks from collector devices on the same session
        const { session: currentSess } = useAppStore.getState()
        if (currentSess) {
          collectorChannelRef.current = supabase
            .channel('collector-chunks')
            .on('postgres_changes', {
              event: 'INSERT', schema: 'public', table: 'transcript_chunks',
              filter: `session_id=eq.${currentSess.id}`,
            }, (payload: any) => {
              if (!payload.new?.content) return
              if (payload.new.device_id === deviceId.current) return
              const { activeTeam: team } = useAppStore.getState()
              if (payload.new.team_id !== team?.id) return
              bufferRef.current += ' ' + payload.new.content
              const words = bufferRef.current.split(/\s+/).filter(Boolean)
              if (words.length > MAX_BUFFER_WORDS) {
                bufferRef.current = words.slice(-MAX_BUFFER_WORDS).join(' ')
              }
            })
            .subscribe()
        }
      })

      conn.on('message', (message: any) => {
        if (stoppedRef.current) return
        if (message?.type !== 'Results') return
        const alt = message?.channel?.alternatives?.[0]
        if (!alt?.transcript?.trim()) return
        if (!message.is_final) {
          useAppStore.getState().setInterimTranscript(alt.transcript)
          return
        }
        useAppStore.getState().setInterimTranscript('')
        appendTranscript(alt.transcript)
        bufferRef.current += ' ' + alt.transcript

        const words = bufferRef.current.split(/\s+/).filter(Boolean)
        if (words.length > MAX_BUFFER_WORDS) {
          bufferRef.current = words.slice(-MAX_BUFFER_WORDS).join(' ')
        }

        const { activeTeam: team, session: sess } = useAppStore.getState()
        try {
          if (team) {
            sessionStorage.setItem('aj_transcript_buffer', bufferRef.current)
            sessionStorage.setItem('aj_transcript_team_id', team.id)
          }
        } catch (_) {}

        if (team && sess) {
          supabase.from('transcript_chunks')
            .insert({ session_id: sess.id, team_id: team.id, content: alt.transcript, device_id: deviceId.current })
            .then(() => {})
        }

        const wordCount = bufferRef.current.split(/\s+/).filter(Boolean).length
        if (wordCount - wordCountAtLastJudgeRef.current >= WORDS_PER_CYCLE) {
          runCycle()
        }
      })

      conn.on('error', (e: any) => {
        if (stoppedRef.current) return
        console.error('[deepgram] Error:', e)
        useAppStore.getState().setConnecting(false)
        useAppStore.getState().setRecording(false)
      })

      conn.on('close', () => {
        if (stoppedRef.current) return
        useAppStore.getState().setRecording(false)
      })

      conn.connect()
    } catch (e: any) {
      console.error('Start recording error:', e)
      useAppStore.getState().setConnecting(false)
      useAppStore.getState().setJudgeError(e?.message ?? 'Failed to start recording')
    }
  }, [runCycle, clearBuffer, captureMode])

  const stop = useCallback(async () => {
    stoppedRef.current = true
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (collectorChannelRef.current) {
      try { createSupabaseClient().removeChannel(collectorChannelRef.current) } catch (_) {}
      collectorChannelRef.current = null
    }
    mediaRecorderRef.current?.stop()
    try { connectionRef.current?.sendCloseStream({}) } catch (_) {}
    streamRef.current?.getTracks().forEach((t) => t.stop())
    mediaRecorderRef.current = null
    connectionRef.current = null
    streamRef.current = null
    wordCountAtLastJudgeRef.current = 0
    useAppStore.getState().setInterimTranscript('')
    useAppStore.getState().setRecordingStartedAt(null)
    // Update UI immediately so the button responds at once
    useAppStore.getState().setConnecting(false)
    useAppStore.getState().setRecording(false)

    await runCycle({ final: true })
    clearBuffer()
  }, [runCycle, clearBuffer])

  // Snapshot the current session: run a final scoring cycle, create the next
  // session slot on the server, then reset the buffer. The Deepgram connection
  // stays open so audio capture is seamless.
  const punctuate = useCallback(async () => {
    const { session, setActiveTeam } = useAppStore.getState()
    if (!session) return

    await runCycle({ final: true })

    const res = await fetch('/api/auto-transition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: session.id, manual: true }),
    })
    const data = await res.json()
    if (!data.transition || !data.team) return

    // setActiveTeam clears scores/transcript/summary in the store
    setActiveTeam(data.team)
    useAppStore.setState((s: any) => ({ teams: [...s.teams, data.team] }))
    clearBuffer()
  }, [runCycle, clearBuffer])

  return { start, stop, punctuate }
}
