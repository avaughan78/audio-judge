'use client'

import { useRef, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { createClient as createSupabaseClient } from '@/lib/supabase'

const WORDS_PER_CYCLE = 40
const CYCLE_INTERVAL_MS = 12_000
const TRANSITION_CHECK_WORDS = 30
const MIN_WORDS_BEFORE_TRANSITION = 60
const MAX_BUFFER_WORDS = 8_000  // prevent unbounded memory growth on long events

function getDeviceId(): string {
  try {
    let id = sessionStorage.getItem('aj_device_id')
    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem('aj_device_id', id) }
    return id
  } catch (_) { return crypto.randomUUID() }
}

export function useAudioCapture() {
  const deviceId = useRef(getDeviceId())
  const connectionRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  // All mutable values are refs rather than state because they are read inside
  // WebSocket event handlers (closures). State updates are async and the handler
  // would always see the stale initial value.
  const bufferRef = useRef('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isJudgingRef = useRef(false)
  const wordCountAtLastJudgeRef = useRef(0)
  const wordCountAtLastTransitionCheckRef = useRef(0)
  // Set to true in stop() before closing the connection. The Deepgram SDK may
  // fire 'close' or 'open' events after we call disconnect — this flag prevents
  // those late events from flipping isRecording back on.
  const stoppedRef = useRef(false)
  const isDetectingRef = useRef(false)
  const collectorChannelRef = useRef<any>(null)

  // Sends the current transcript buffer to /api/judge and /api/summarise in parallel.
  // Called both on a word-count trigger and a periodic timer; the isJudgingRef guard
  // ensures only one cycle runs at a time regardless of which trigger fires.
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

  // Calls the server-side /api/auto-transition endpoint which atomically detects
  // a presenter change (or triggers one manually) and creates the new team row.
  // Server-side to prevent race conditions when multiple clients are open.
  const checkTransition = useCallback(async () => {
    if (isDetectingRef.current) return
    const state = useAppStore.getState()
    const { session, setActiveTeam } = state

    const totalWords = bufferRef.current.split(/\s+/).filter(Boolean).length
    if (totalWords < MIN_WORDS_BEFORE_TRANSITION) return

    wordCountAtLastTransitionCheckRef.current = totalWords
    isDetectingRef.current = true

    try {
      const recentTranscript = bufferRef.current.split(/\s+/).filter(Boolean).slice(-120).join(' ')
      const res = await fetch('/api/auto-transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session?.id, recentTranscript, manual: false }),
      })
      const data = await res.json()

      if (!data.transition || !data.team) return

      // Score the outgoing presenter before switching
      await runCycle({ final: true })

      setActiveTeam(data.team)
      useAppStore.setState((s: any) => ({ teams: [...s.teams, data.team] }))
      bufferRef.current = ''
      wordCountAtLastJudgeRef.current = 0
      wordCountAtLastTransitionCheckRef.current = 0

      // Persist buffer reset to sessionStorage
      try {
        sessionStorage.removeItem('aj_transcript_buffer')
        sessionStorage.removeItem('aj_transcript_team_id')
      } catch (_) {}

      console.log('[auto] Switched to:', data.team.name)
    } catch (e) {
      console.error('[auto] Transition check error:', e)
    } finally {
      isDetectingRef.current = false
    }
  }, [runCycle])

  const start = useCallback(async () => {
    const { setConnecting, setRecording, appendTranscript, setRecordingStartedAt } =
      useAppStore.getState()
    let { activeTeam, session } = useAppStore.getState()

    if (!activeTeam) {
      if (session?.detection_mode !== 'automatic') return
      // Auto mode with no team yet — create "Presenter 1" via server
      const res = await fetch('/api/auto-transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, manual: true }),
      })
      const data = await res.json()
      if (!data.transition || !data.team) {
        console.error('[auto] Failed to create initial presenter')
        return
      }
      useAppStore.getState().setActiveTeam(data.team)
      useAppStore.setState((s: any) => ({ teams: [...s.teams, data.team] }))
      activeTeam = data.team
    }

    // Restore transcript buffer from sessionStorage in case of page refresh mid-session
    try {
      const savedBuffer = sessionStorage.getItem('aj_transcript_buffer')
      const savedTeamId = sessionStorage.getItem('aj_transcript_team_id')
      if (savedBuffer && savedTeamId === activeTeam?.id) {
        bufferRef.current = savedBuffer
        wordCountAtLastJudgeRef.current = savedBuffer.split(/\s+/).filter(Boolean).length
        console.log('[audio] Restored transcript buffer from sessionStorage:', wordCountAtLastJudgeRef.current, 'words')
      }
    } catch (_) {}

    stoppedRef.current = false
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

      const { DeepgramClient } = await import('@deepgram/sdk')
      const dg = new DeepgramClient({ apiKey: key })

      // Create one Supabase client per session to avoid creating a new one on every transcript chunk
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
        // Guard: if MediaRecorder already exists the SDK reconnected — don't re-init
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
              if (payload.new.device_id === deviceId.current) return // skip own chunks
              const { activeTeam: team } = useAppStore.getState()
              if (payload.new.team_id !== team?.id) return // skip other teams' chunks
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
        if (message.is_final) {
          useAppStore.getState().setInterimTranscript('')
          appendTranscript(alt.transcript)
          bufferRef.current += ' ' + alt.transcript

          // Cap buffer to prevent unbounded memory growth on long events
          const words = bufferRef.current.split(/\s+/).filter(Boolean)
          if (words.length > MAX_BUFFER_WORDS) {
            bufferRef.current = words.slice(-MAX_BUFFER_WORDS).join(' ')
          }

          // Persist to sessionStorage so a page refresh can recover the buffer
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

          const newWordsSinceJudge = wordCount - wordCountAtLastJudgeRef.current
          if (newWordsSinceJudge >= WORDS_PER_CYCLE) {
            runCycle()
          }

          const { session: currentSession } = useAppStore.getState()
          if (currentSession?.detection_mode === 'automatic') {
            const newWordsSinceCheck = wordCount - wordCountAtLastTransitionCheckRef.current
            if (newWordsSinceCheck >= TRANSITION_CHECK_WORDS) {
              checkTransition()
            }
          }
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
    } catch (e) {
      console.error('Start recording error:', e)
      useAppStore.getState().setConnecting(false)
    }
  }, [runCycle, checkTransition])

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
    wordCountAtLastTransitionCheckRef.current = 0
    useAppStore.getState().setInterimTranscript('')
    useAppStore.getState().setRecordingStartedAt(null)
    await runCycle({ final: true })
    useAppStore.getState().setRecording(false)
    bufferRef.current = ''
    try {
      sessionStorage.removeItem('aj_transcript_buffer')
      sessionStorage.removeItem('aj_transcript_team_id')
    } catch (_) {}
  }, [runCycle])

  // Manual mode: score the current presenter, then switch to the next team in the list.
  const advanceToNextTeam = useCallback(async () => {
    const state = useAppStore.getState()
    const { teams, activeTeam, session, setActiveTeam, setScores } = state
    if (!activeTeam || !session || !teams.length) return

    const currentIndex = teams.findIndex(t => t.id === activeTeam.id)
    const nextTeam = teams[currentIndex + 1]
    if (!nextTeam) return

    await runCycle({ final: true })

    const supabase = createSupabaseClient()
    await supabase.from('sessions').update({ active_team_id: nextTeam.id }).eq('id', session.id)

    const { data: existingScores } = await supabase.from('scores').select('*')
      .eq('session_id', session.id).eq('team_id', nextTeam.id)

    setActiveTeam(nextTeam)
    if (existingScores?.length) {
      const map: Record<string, any> = {}
      existingScores.forEach((s: any) => { map[s.criteria_id] = s })
      setScores(map)
    }

    bufferRef.current = ''
    wordCountAtLastJudgeRef.current = 0
    wordCountAtLastTransitionCheckRef.current = 0
    try {
      sessionStorage.removeItem('aj_transcript_buffer')
      sessionStorage.removeItem('aj_transcript_team_id')
    } catch (_) {}
  }, [runCycle])

  // Auto mode: manually trigger a presenter switch without waiting for AI detection.
  // Useful when automatic detection misses an intro — judge presses the button as a fallback.
  const manualAdvanceAutoMode = useCallback(async () => {
    const { session } = useAppStore.getState()
    if (!session) return

    await runCycle({ final: true })

    const res = await fetch('/api/auto-transition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: session.id, manual: true }),
    })
    const data = await res.json()
    if (!data.transition || !data.team) return

    useAppStore.getState().setActiveTeam(data.team)
    useAppStore.setState((s: any) => ({ teams: [...s.teams, data.team] }))
    bufferRef.current = ''
    wordCountAtLastJudgeRef.current = 0
    wordCountAtLastTransitionCheckRef.current = 0
    try {
      sessionStorage.removeItem('aj_transcript_buffer')
      sessionStorage.removeItem('aj_transcript_team_id')
    } catch (_) {}
  }, [runCycle])

  return { start, stop, advanceToNextTeam, manualAdvanceAutoMode }
}
