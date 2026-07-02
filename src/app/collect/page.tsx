'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ThemeProvider, ThemeSelector } from '@/components/ThemeSelector'
import { useCollectorCapture } from '@/hooks/useCollectorCapture'

export default function CollectPage() {
  const router = useRouter()

  // Auth
  const [authChecked, setAuthChecked] = useState(false)

  // Active session state (driven by realtime)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null)
  const [eventName, setEventName] = useState<string | null>(null)

  // Mic permission + ready state
  const [isReady, setIsReady] = useState(false)
  const [setupError, setSetupError] = useState<string | null>(null)

  const prevActiveTeamId = useRef<string | null>(null)

  const { start, stop, isRecording, isConnecting, transcript, interimTranscript } =
    useCollectorCapture(sessionId, activeTeamId)

  // Auth check — redirect to login if not signed in
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push('/login?from=/collect')
      }
      setAuthChecked(true)
    })
  }, [router])

  // Subscribe to active session realtime (only once ready + authed)
  useEffect(() => {
    if (!isReady || !authChecked) return
    const supabase = createClient()

    async function loadActive() {
      const { data } = await supabase
        .from('sessions')
        .select('id, name, active_team_id')
        .eq('is_active', true)
        .maybeSingle()
      if (data) {
        setSessionId(data.id)
        setActiveTeamId(data.active_team_id)
        setEventName(data.name)
      }
    }

    loadActive()

    const channel = supabase
      .channel('collector-watch')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions' }, (payload: any) => {
        if (payload.new?.is_active) {
          setSessionId(payload.new.id)
          setActiveTeamId(payload.new.active_team_id ?? null)
          setEventName(payload.new.name)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [isReady, authChecked])

  // Auto start/stop based on activeTeamId transitions
  useEffect(() => {
    if (!isReady) return
    const prev = prevActiveTeamId.current
    prevActiveTeamId.current = activeTeamId

    if (!prev && activeTeamId) {
      start()
    } else if (prev && !activeTeamId) {
      stop()
    }
  }, [activeTeamId, isReady, start, stop])

  // One-time mic permission tap
  const activate = useCallback(async () => {
    setSetupError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(t => t.stop())
      setIsReady(true)
    } catch (e: any) {
      setSetupError(e.message ?? 'Microphone access denied')
    }
  }, [])

  const deactivate = useCallback(() => {
    stop()
    prevActiveTeamId.current = null
    setIsReady(false)
    setSessionId(null)
    setActiveTeamId(null)
  }, [stop])

  if (!authChecked) return null

  return (
    <ThemeProvider>
      <div className="fixed inset-0 flex flex-col overflow-hidden" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>

        {/* Ambient */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-[0.07]"
            style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 65%)' }} />
        </div>

        {/* Header: brand + "Collector" label + ThemeSelector only — no nav links */}
        <header className="relative z-10 shrink-0 flex items-center justify-between px-5 h-14"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-glass)', backdropFilter: 'blur(12px)' }}>
          <div className="flex items-center gap-3">
            <img src="/app-icon.svg" alt="Audio Judge" className="w-7 h-7" />
            <span className="font-bold gradient-text">Audio Judge</span>
            <span style={{ color: 'var(--border-hover)' }}>·</span>
            <span className="text-sm font-semibold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>
              Collector
            </span>
          </div>
          <ThemeSelector />
        </header>

        {/* Body */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-8 p-8 text-center">

          {!isReady ? (
            /* ── Activation screen ── */
            <div className="flex flex-col items-center gap-6 max-w-sm">
              <div className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ background: 'var(--accent-dim)', border: '1px solid var(--border-hover)' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                  style={{ color: 'var(--accent)' }}>
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              </div>

              <div>
                <h1 className="text-2xl font-bold mb-2">Collector mode</h1>
                <p className="text-base leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  This device will follow the recording session automatically —
                  no controls needed. Tap below to allow mic access and stand by.
                </p>
              </div>

              {setupError && (
                <p className="text-sm px-4 py-2 rounded-lg w-full"
                  style={{ color: 'var(--score-low)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {setupError}
                </p>
              )}

              <button
                onClick={activate}
                className="w-full px-8 py-4 rounded-2xl text-base font-bold transition-all"
                style={{ background: 'var(--accent)', color: 'white', boxShadow: '0 4px 24px var(--glow-accent)' }}
              >
                Allow mic &amp; stand by
              </button>
            </div>

          ) : (
            /* ── Status screen ── */
            <div className="flex flex-col items-center gap-6 max-w-sm w-full">

              {isRecording ? (
                <>
                  {/* Pulsing record dot */}
                  <div className="relative w-24 h-24 flex items-center justify-center">
                    <span className="absolute w-24 h-24 rounded-full animate-ping opacity-20"
                      style={{ background: 'var(--score-low)' }} />
                    <span className="w-16 h-16 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(239,68,68,0.12)', border: '2px solid var(--score-low)' }}>
                      <span className="w-6 h-6 rounded-full" style={{ background: 'var(--score-low)' }} />
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-bold tracking-widest uppercase mb-1"
                      style={{ color: 'var(--score-low)' }}>Recording</p>
                    {eventName && (
                      <p className="text-lg font-semibold">{eventName}</p>
                    )}
                  </div>

                  {/* Live transcript preview */}
                  {(transcript || interimTranscript) && (
                    <div className="w-full rounded-xl p-4 text-left overflow-y-auto"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', maxHeight: '200px' }}>
                      <p className="text-xs font-bold tracking-widest uppercase mb-2"
                        style={{ color: 'var(--text-muted)' }}>Captured</p>
                      <p className="text-sm leading-relaxed font-mono"
                        style={{ color: 'var(--text-secondary)' }}>
                        {transcript}
                        {interimTranscript && (
                          <span className="opacity-50 italic"> {interimTranscript}</span>
                        )}
                      </p>
                    </div>
                  )}
                </>
              ) : isConnecting ? (
                <>
                  <div className="w-10 h-10 rounded-full border-2 animate-spin"
                    style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
                  <p className="text-base" style={{ color: 'var(--text-muted)' }}>Connecting…</p>
                </>
              ) : (
                <>
                  {/* Standby */}
                  <div className="w-20 h-20 rounded-full flex items-center justify-center"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                      style={{ color: 'var(--text-muted)' }}>
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xl font-semibold mb-1">Standing by</p>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {eventName
                        ? `Waiting for ${eventName} to start recording`
                        : 'Waiting for a session to go live…'}
                    </p>
                  </div>
                </>
              )}

              <button
                onClick={deactivate}
                className="text-xs px-3 py-1.5 rounded-lg mt-2 transition-all"
                style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
              >
                Deactivate
              </button>
            </div>
          )}
        </div>
      </div>
    </ThemeProvider>
  )
}
