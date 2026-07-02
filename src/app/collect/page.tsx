'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase'
import { ThemeProvider, ThemeSelector } from '@/components/ThemeSelector'
import { useCollectorCapture } from '@/hooks/useCollectorCapture'
import BrandName from '@/components/BrandName'

export default function CollectPage() {
  const router = useRouter()

  const [authChecked, setAuthChecked] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null)
  const [eventName, setEventName] = useState<string | null>(null)
  const [teamName, setTeamName] = useState<string | null>(null)
  const [isMainRecording, setIsMainRecording] = useState(false)

  // isReady = mic permission granted. isPaused = user manually deactivated.
  const [isReady, setIsReady] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [needsManualActivation, setNeedsManualActivation] = useState(false)
  const [setupError, setSetupError] = useState<string | null>(null)

  // Stable refs to start/stop so the drive-effect doesn't stale-close
  const startRef = useRef<(() => Promise<void>) | null>(null)
  const stopRef = useRef<(() => void) | null>(null)
  const recordingStartedRef = useRef(false)

  const { start, stop, isRecording, isConnecting, transcript, interimTranscript } =
    useCollectorCapture(sessionId, activeTeamId)

  useEffect(() => { startRef.current = start }, [start])
  useEffect(() => { stopRef.current = stop }, [stop])

  // 1. Auth check
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (!data.user) router.push('/login?from=/collect')
      else setAuthChecked(true)
    })
  }, [router])

  // 2. Auto-request mic on load (no button required for the happy path)
  useEffect(() => {
    if (!authChecked) return
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => { stream.getTracks().forEach(t => t.stop()); setIsReady(true) })
      .catch(() => setNeedsManualActivation(true))
  }, [authChecked])

  // 3. Subscribe to session realtime once mic is ready
  useEffect(() => {
    if (!isReady || !authChecked) return
    const supabase = createClient()

    async function loadActive() {
      const { data } = await supabase
        .from('sessions')
        .select('id, name, active_team_id, is_recording')
        .eq('is_active', true)
        .maybeSingle()
      if (!data) return
      setSessionId(data.id)
      setEventName(data.name)
      setActiveTeamId(data.active_team_id ?? null)
      setIsMainRecording(data.is_recording ?? false)
      if (data.active_team_id) {
        const { data: team } = await supabase.from('teams').select('name').eq('id', data.active_team_id).single()
        setTeamName(team?.name ?? null)
      }
    }

    loadActive()

    const channel = supabase.channel('collector-watch')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions' }, async (payload: any) => {
        if (!payload.new?.is_active) return
        setSessionId(payload.new.id)
        setEventName(payload.new.name)
        setActiveTeamId(payload.new.active_team_id ?? null)
        setIsMainRecording(payload.new.is_recording ?? false)
        if (payload.new.active_team_id) {
          const { data: team } = await supabase.from('teams').select('name').eq('id', payload.new.active_team_id).single()
          setTeamName(team?.name ?? null)
        } else {
          setTeamName(null)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [isReady, authChecked])

  // 4. Drive recording from main page's is_recording state
  useEffect(() => {
    const shouldRecord = isReady && !isPaused && !!sessionId && !!activeTeamId && isMainRecording
    if (shouldRecord && !recordingStartedRef.current) {
      recordingStartedRef.current = true
      startRef.current?.()
    } else if (!shouldRecord && recordingStartedRef.current) {
      recordingStartedRef.current = false
      stopRef.current?.()
    }
  }, [isReady, isPaused, sessionId, activeTeamId, isMainRecording])

  // 5. Hold wake lock to prevent display sleep (standby + recording)
  useEffect(() => {
    if (!isReady || isPaused) return
    let lock: any = null
    const acquire = async () => {
      if (!('wakeLock' in navigator)) return
      try { lock = await (navigator as any).wakeLock.request('screen') } catch (_) {}
    }
    acquire()
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !lock) acquire()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      lock?.release().catch(() => {})
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [isReady, isPaused])

  const activate = useCallback(async () => {
    setSetupError(null)
    if (isPaused) { setIsPaused(false); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(t => t.stop())
      setNeedsManualActivation(false)
      setIsReady(true)
    } catch (e: any) {
      setSetupError(e.message ?? 'Microphone access denied')
    }
  }, [isPaused])

  const deactivate = useCallback(() => {
    setIsPaused(true)
  }, [])

  if (!authChecked) return null

  const showActivation = needsManualActivation || isPaused
  const isActive = isReady && !isPaused

  return (
    <ThemeProvider>
      <div className="fixed inset-0 flex flex-col overflow-hidden" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>

        {/* Animated ambient glows */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
          <motion.div
            className="absolute -top-32 left-1/3 w-[600px] h-[600px] rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 65%)' }}
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 9, repeat: Infinity }}
          />
          <motion.div
            className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full opacity-[0.07]"
            style={{ background: 'radial-gradient(circle, var(--accent-secondary) 0%, transparent 65%)' }}
            animate={{ scale: [1.1, 1, 1.1] }}
            transition={{ duration: 9, repeat: Infinity }}
          />
        </div>

        {/* Header */}
        <header className="relative z-10 shrink-0 flex items-center justify-between px-5 h-14"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-glass)', backdropFilter: 'blur(12px)' }}>
          <div className="flex items-center gap-3">
            <BrandName />
            <span style={{ color: 'var(--border-hover)' }}>·</span>
            <span className="text-sm font-semibold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>
              Collector
            </span>
          </div>
          <div className="flex items-center gap-3">
            {eventName && (
              <span className="text-sm truncate max-w-[160px]" style={{ color: 'var(--text-muted)' }}>{eventName}</span>
            )}
            <ThemeSelector />
          </div>
        </header>

        {/* Body */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-8 text-center">
          <AnimatePresence mode="wait">

            {showActivation ? (
              /* ── Activation / Paused screen ── */
              <motion.div key="activation"
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center gap-6 max-w-sm w-full">

                <div className="w-20 h-20 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--accent-dim)', border: '1px solid var(--border-hover)' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                    style={{ color: 'var(--accent)' }}>
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" />
                  </svg>
                </div>

                <div>
                  <h1 className="text-2xl font-bold mb-2">
                    {isPaused ? 'Collector paused' : 'Allow microphone'}
                  </h1>
                  <p className="text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {isPaused
                      ? 'Tap to resume. Recording will follow the session automatically.'
                      : 'Tap to grant mic access. Recording will start and stop automatically — no controls needed.'}
                  </p>
                </div>

                {setupError && (
                  <p className="text-sm px-4 py-2 rounded-lg w-full"
                    style={{ color: 'var(--score-low)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    {setupError}
                  </p>
                )}

                <button onClick={activate}
                  className="w-full px-8 py-4 rounded-2xl text-base font-bold"
                  style={{ background: 'var(--accent)', color: 'white', boxShadow: '0 4px 24px var(--glow-accent)' }}>
                  {isPaused ? 'Resume' : 'Allow mic & stand by'}
                </button>
              </motion.div>

            ) : isRecording ? (
              /* ── Recording ── */
              <motion.div key="recording"
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-6 max-w-sm w-full">

                <div className="relative w-28 h-28 flex items-center justify-center">
                  <motion.span className="absolute w-28 h-28 rounded-full opacity-20"
                    style={{ background: 'var(--score-low)' }}
                    animate={{ scale: [1, 1.4, 1], opacity: [0.2, 0, 0.2] }}
                    transition={{ duration: 2, repeat: Infinity }} />
                  <span className="w-20 h-20 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(239,68,68,0.12)', border: '2px solid var(--score-low)' }}>
                    <span className="w-8 h-8 rounded-full" style={{ background: 'var(--score-low)' }} />
                  </span>
                </div>

                <div>
                  <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: 'var(--score-low)' }}>
                    Recording
                  </p>
                  {teamName && (
                    <AnimatePresence mode="wait">
                      <motion.div key={teamName}
                        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
                        <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--text-muted)' }}>
                          Now presenting
                        </p>
                        <p className="text-2xl font-black">{teamName}</p>
                      </motion.div>
                    </AnimatePresence>
                  )}
                </div>

                {(transcript || interimTranscript) && (
                  <div className="w-full rounded-xl p-4 text-left overflow-y-auto"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', maxHeight: '180px' }}>
                    <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Captured</p>
                    <p className="text-sm leading-relaxed font-mono" style={{ color: 'var(--text-secondary)' }}>
                      {transcript}
                      {interimTranscript && <span className="opacity-50 italic"> {interimTranscript}</span>}
                    </p>
                  </div>
                )}

                <button onClick={deactivate} className="text-xs px-3 py-1.5 rounded-lg transition-all"
                  style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}>
                  Pause
                </button>
              </motion.div>

            ) : isConnecting ? (
              /* ── Connecting ── */
              <motion.div key="connecting"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 rounded-full border-2 animate-spin"
                  style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
                <p className="text-base" style={{ color: 'var(--text-secondary)' }}>Connecting…</p>
              </motion.div>

            ) : isActive && isMainRecording ? (
              /* ── Main is recording but collector not yet connected ── */
              <motion.div key="starting"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 rounded-full border-2 animate-spin"
                  style={{ borderColor: 'var(--border)', borderTopColor: 'var(--score-low)' }} />
                <p className="text-base" style={{ color: 'var(--text-secondary)' }}>Starting…</p>
              </motion.div>

            ) : (
              /* ── Standby ── */
              <motion.div key="standby"
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-6 max-w-sm w-full">

                <motion.div
                  className="w-20 h-20 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                  animate={{ scale: [1, 1.04, 1] }}
                  transition={{ duration: 3, repeat: Infinity }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                    style={{ color: 'var(--text-muted)' }}>
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" />
                  </svg>
                </motion.div>

                <div>
                  <p className="text-xl font-bold mb-1">Standing by</p>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {eventName
                      ? `Waiting for ${eventName} to start recording`
                      : 'Waiting for a session to go live…'}
                  </p>
                </div>

                <button onClick={deactivate} className="text-xs px-3 py-1.5 rounded-lg transition-all"
                  style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}>
                  Pause
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </ThemeProvider>
  )
}
