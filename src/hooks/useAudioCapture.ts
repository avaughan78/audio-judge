'use client'

import { useRef, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { createClient as createSupabaseClient } from '@/lib/supabase'

const WORDS_PER_CYCLE = 40   // trigger a score after every 40 new words
const CYCLE_INTERVAL_MS = 12_000  // also trigger on a 12s timer as fallback
// In auto mode, check for presenter transition after every N new words (but not too frequently)
const TRANSITION_CHECK_WORDS = 30
const MIN_WORDS_BEFORE_TRANSITION = 60  // don't detect transitions in the first ~60 words

export function useAudioCapture() {
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

  // Sends the current transcript buffer to /api/judge and /api/summarise in parallel.
  // Called both on a word-count trigger and a periodic timer; the isJudgingRef guard
  // ensures only one cycle runs at a time regardless of which trigger fires.
  const runCycle = useCallback(async () => {
    if (isJudgingRef.current) return
    const state = useAppStore.getState()
    const { activeTeam, session, setSummarising, setSummary, setLastJudgedAt } = state
    const transcript = bufferRef.current.trim()
    if (!transcript || !activeTeam || !session) {
      console.log('[judge] runCycle skipped — missing:', { hasTranscript: !!transcript, hasTeam: !!activeTeam, hasSession: !!session })
      return
    }

    console.log('[judge] Starting cycle — words:', transcript.split(/\s+/).filter(Boolean).length)
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
          }),
        }).then(async (r) => {
          const data = await r.json()
          if (!r.ok) throw new Error(`/api/judge ${r.status}: ${JSON.stringify(data)}`)
          return data
        }),
        fetch('/api/summarise', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript, brief: session.brief, teamId: activeTeam.id }),
        }).then((r) => r.json()),
      ])

      if (judgeRes.status === 'fulfilled') {
        console.log('[judge] API success:', judgeRes.value)
      } else {
        console.error('[judge] API failed:', judgeRes.reason)
      }

      if (summaryRes.status === 'fulfilled' && summaryRes.value?.summary) {
        setSummary(summaryRes.value.summary)
      }
      setLastJudgedAt(Date.now())
      console.log('[judge] Cycle complete')
    } catch (e) {
      console.error('[judge] Cycle error:', e)
    } finally {
      setSummarising(false)
      isJudgingRef.current = false
    }
  }, [])

  // Called in automatic mode after enough new words have accumulated.
  // If a transition is detected, creates a new team, switches to it, and resets the buffer.
  const checkTransition = useCallback(async () => {
    if (isDetectingRef.current) return
    const state = useAppStore.getState()
    const { session, setActiveTeam, incrementAutoTeamCounter, autoTeamCounter } = state

    const totalWords = bufferRef.current.split(/\s+/).filter(Boolean).length
    if (totalWords < MIN_WORDS_BEFORE_TRANSITION) return

    wordCountAtLastTransitionCheckRef.current = totalWords
    isDetectingRef.current = true

    try {
      // Send the last ~60 seconds of speech for transition detection
      const recentTranscript = bufferRef.current.split(/\s+/).filter(Boolean).slice(-120).join(' ')
      const res = await fetch('/api/detect-transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recentTranscript }),
      })
      const data = await res.json()
      console.log('[auto] Transition check result:', data)

      if (!data.transition || !session) return

      // Run a final scoring cycle for the current team before switching
      await runCycle()

      // Create a new team in the DB
      const supabase = createSupabaseClient()
      const newTeamNumber = autoTeamCounter + 1
      const newName = data.name?.trim() || `Presenter ${newTeamNumber}`

      const { data: newTeam, error } = await supabase
        .from('teams')
        .insert({
          session_id: session.id,
          name: newName,
          order_index: newTeamNumber,
        })
        .select()
        .single()

      if (error || !newTeam) {
        console.error('[auto] Failed to create team:', error)
        return
      }

      // Update sessions.active_team_id so the display page switches
      await supabase.from('sessions').update({ active_team_id: newTeam.id }).eq('id', session.id)

      // Switch locally
      incrementAutoTeamCounter()
      setActiveTeam(newTeam)
      bufferRef.current = ''
      wordCountAtLastJudgeRef.current = 0
      wordCountAtLastTransitionCheckRef.current = 0

      // Also add the new team to the local teams list
      const { teams } = useAppStore.getState()
      useAppStore.setState({ teams: [...teams, newTeam] })

      console.log('[auto] Switched to new team:', newName)
    } catch (e) {
      console.error('[auto] Transition check error:', e)
    } finally {
      isDetectingRef.current = false
    }
  }, [runCycle])

  const start = useCallback(async () => {
    const { setConnecting, setRecording, appendTranscript, setInterimTranscript, setRecordingStartedAt } =
      useAppStore.getState()
    let { activeTeam, session } = useAppStore.getState()

    if (!activeTeam) {
      if (session?.detection_mode !== 'automatic') return
      // Auto mode with no team yet — create "Presenter 1" so scoring works immediately
      const supabase = createSupabaseClient()
      const { data: newTeam, error } = await supabase
        .from('teams')
        .insert({ session_id: session.id, name: 'Presenter 1', order_index: 1 })
        .select()
        .single()
      if (error || !newTeam) {
        console.error('[auto] Failed to create initial team:', error)
        return
      }
      await supabase.from('sessions').update({ active_team_id: newTeam.id }).eq('id', session.id)
      useAppStore.getState().incrementAutoTeamCounter()
      useAppStore.getState().setActiveTeam(newTeam)
      useAppStore.setState((s: any) => ({ teams: [...s.teams, newTeam] }))
    }

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
        console.log('[deepgram] Connected')
        setConnecting(false)
        setRecording(true)
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

        // Fallback timer: score every 12s even if word count hasn't been hit
        timerRef.current = setInterval(runCycle, CYCLE_INTERVAL_MS)
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
          console.log('[deepgram] Final transcript chunk, total words:', bufferRef.current.split(/\s+/).filter(Boolean).length)

          // Write to transcript_chunks so the display page ticker updates
          const { activeTeam: team, session: sess } = useAppStore.getState()
          if (team && sess) {
            createSupabaseClient()
              .from('transcript_chunks')
              .insert({ session_id: sess.id, team_id: team.id, content: alt.transcript })
              .then(() => {})
          }

          const wordCount = bufferRef.current.split(/\s+/).filter(Boolean).length

          // Trigger a scoring cycle after every WORDS_PER_CYCLE new words
          const newWordsSinceJudge = wordCount - wordCountAtLastJudgeRef.current
          if (newWordsSinceJudge >= WORDS_PER_CYCLE) {
            runCycle()
          }

          // In automatic mode, check for presenter transitions periodically
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
        console.log('[deepgram] Connection closed')
        useAppStore.getState().setRecording(false)
      })

      conn.connect()
    } catch (e) {
      console.error('Start recording error:', e)
      useAppStore.getState().setConnecting(false)
    }
  }, [runCycle, checkTransition])

  const stop = useCallback(async () => {
    stoppedRef.current = true  // block any SDK reconnect events from this point on
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
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
    await runCycle()
    useAppStore.getState().setRecording(false)
    bufferRef.current = ''
  }, [runCycle])

  // Advance to the next team in manual mode: score the current buffer, then switch.
  const advanceToNextTeam = useCallback(async () => {
    const state = useAppStore.getState()
    const { teams, activeTeam, session, setActiveTeam, setScores } = state
    if (!activeTeam || !session || !teams.length) return

    const currentIndex = teams.findIndex(t => t.id === activeTeam.id)
    const nextTeam = teams[currentIndex + 1]
    if (!nextTeam) return

    await runCycle()

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
  }, [runCycle])

  return { start, stop, advanceToNextTeam }
}
