'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { createClient } from '@/lib/supabase'
import { TranscriptSummary } from '@/components/TranscriptSummary'
import { TranscriptTicker } from '@/components/TranscriptTicker'
import { ScorePanel } from '@/components/ScorePanel'
import { RecordingControl } from '@/components/RecordingControl'
import { ThemeSelector, ThemeProvider } from '@/components/ThemeSelector'
import { useAudioCapture } from '@/hooks/useAudioCapture'
import { useSessionPresence } from '@/hooks/useSessionPresence'
import type { CaptureMode } from '@/hooks/useCollectorCapture'
import { getDeviceId } from '@/lib/deviceId'

export default function JudgePage() {
  const { session, setSession, setTeams, setCriteria, updateScore, setThemeId, setActiveTeam, setScores } = useAppStore()
  const activeTeam = useAppStore((s) => s.activeTeam)
  const teams = useAppStore((s) => s.teams)
  const isRecording = useAppStore((s) => s.isRecording)
  const isSummarising = useAppStore((s) => s.isSummarising)
  const judgeError = useAppStore((s) => s.judgeError)
  const [prevTeamName, setPrevTeamName] = useState<string | null>(null)
  const [showTransition, setShowTransition] = useState(false)
  const [missingKeys, setMissingKeys] = useState<string[]>([])
  const [confirmPunctuate, setConfirmPunctuate] = useState(false)
  const [isPunctuating, setIsPunctuating] = useState(false)
  const [mobileTab, setMobileTab] = useState<'scores' | 'summary'>('scores')
  const [captureMode, setCaptureMode] = useState<CaptureMode>(() => {
    try { return (localStorage.getItem('aj_capture_mode') as CaptureMode) ?? 'local' } catch { return 'local' }
  })
  const { start, stop, punctuate } = useAudioCapture(captureMode)

  const setMode = (m: CaptureMode) => {
    setCaptureMode(m)
    try { localStorage.setItem('aj_capture_mode', m) } catch {}
  }
  const deviceId = getDeviceId()
  const { peers } = useSessionPresence(session?.id ?? null, deviceId, 'judge', isRecording)
  const collectors = peers.filter((p) => p.role === 'collector' && p.isRecording)

  useEffect(() => {
    if (!activeTeam) return
    if (prevTeamName && prevTeamName !== activeTeam.name) {
      setShowTransition(true)
      const t = setTimeout(() => setShowTransition(false), 1800)
      return () => clearTimeout(t)
    }
    setPrevTeamName(activeTeam.name)
  }, [activeTeam?.id])

  useEffect(() => {
    if (activeTeam) setPrevTeamName(activeTeam.name)
  }, [activeTeam?.name])

  useEffect(() => {
    fetch('/api/settings/check')
      .then(r => r.json())
      .then(d => { if (!d.ok) setMissingKeys(d.missing) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data: sess } = await supabase
        .from('sessions')
        .select('*')
        .eq('is_active', true)
        .maybeSingle()

      if (!sess) return
      setSession(sess)
      if (sess.theme_id) setThemeId(sess.theme_id)

      const [{ data: loadedTeams }, { data: criteria }] = await Promise.all([
        supabase.from('teams').select('*').eq('session_id', sess.id).order('order_index'),
        supabase.from('criteria').select('*').eq('session_id', sess.id).order('order_index'),
      ])

      if (loadedTeams) setTeams(loadedTeams)
      if (criteria) setCriteria(criteria)

      // Restore active team and its existing scores
      if (sess.active_team_id && loadedTeams) {
        const activeT = loadedTeams.find((t: any) => t.id === sess.active_team_id)
        if (activeT) {
          setActiveTeam(activeT)
          const { data: existingScores } = await supabase.from('scores').select('*')
            .eq('session_id', sess.id).eq('team_id', activeT.id)
          if (existingScores?.length) {
            const map: Record<string, any> = {}
            existingScores.forEach((s: any) => { map[s.criteria_id] = s })
            setScores(map)
          }
        }
      }
    }

    load()

    const rt = createClient()
    let scoreChannel: any = null

    const sessionChannel = rt.channel('session-watch')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions' }, (payload: any) => {
        if (payload.new?.is_active) {
          setSession(payload.new)
          if (payload.new.theme_id) setThemeId(payload.new.theme_id)
        }
      })
      .subscribe()

    const unsub = useAppStore.subscribe((state) => {
      if (state.session && !scoreChannel) {
        scoreChannel = rt.channel('scores-live')
          .on('postgres_changes', {
            event: '*', schema: 'public', table: 'scores',
            filter: `session_id=eq.${state.session.id}`,
          }, (payload: any) => { if (payload.new) updateScore(payload.new) })
          .subscribe()
      }
    })

    return () => {
      rt.removeChannel(sessionChannel)
      if (scoreChannel) rt.removeChannel(scoreChannel)
      unsub()
    }
  }, [])

  const handlePunctuate = async () => {
    setConfirmPunctuate(false)
    setIsPunctuating(true)
    await punctuate()
    setIsPunctuating(false)
  }

  return (
    <ThemeProvider>
      <div className="flex flex-col h-full" style={{ background: 'var(--bg)' }}>

        {/* Ambient orbs */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
          <div className="absolute -top-64 -left-64 w-[600px] h-[600px] rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 65%)' }} />
          <div className="absolute -bottom-64 -right-64 w-[500px] h-[500px] rounded-full opacity-15"
            style={{ background: 'radial-gradient(circle, var(--accent-secondary) 0%, transparent 65%)' }} />
        </div>

        {/* Header */}
        <header className="relative z-10 flex items-center justify-between px-5 h-12 shrink-0"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-glass)', backdropFilter: 'blur(8px)' }}>
          <div className="flex items-center gap-3 min-w-0">
            <img src="/app-icon.svg" alt="Audio Judge" className="w-6 h-6 shrink-0" />
            <span className="text-base font-bold gradient-text shrink-0">Audio Judge</span>
            {session && (
              <>
                <span className="hidden sm:inline" style={{ color: 'var(--text-muted)' }}>·</span>
                <span className="hidden sm:inline text-base truncate" style={{ color: 'var(--text-muted)' }}>{session.name}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-3">
              <ThemeSelector />
              <div className="w-px h-4" style={{ background: 'var(--border)' }} />
              <NavLink href="/display" target="_blank" label="Display" icon="external" />
              <NavLink href="/collect" target="_blank" label="Collect" icon="mic" />
              <NavLink href="/records" label="Records" icon="archive" />
            </div>
            <NavLink href="/admin" label="Admin" icon="settings" />
          </div>
        </header>

        {/* Missing API keys warning */}
        {missingKeys.length > 0 && (
          <div className="relative z-10 flex items-center justify-between gap-3 px-5 py-2"
            style={{ background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)' }}>
            <div className="flex items-center gap-2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p className="text-xs" style={{ color: '#f87171' }}>
                Missing API keys: {missingKeys.join(', ')} — scoring and transcription won't work.
              </p>
            </div>
            <Link href="/admin" className="text-xs font-medium underline underline-offset-2 shrink-0" style={{ color: '#f87171' }}>
              Add in Admin →
            </Link>
          </div>
        )}

        {/* Judge error banner */}
        {judgeError && (
          <div className="relative z-10 flex items-center justify-between gap-3 px-5 py-2"
            style={{ background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)' }}>
            <div className="flex items-center gap-2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p className="text-xs" style={{ color: '#f87171' }}>Scoring error: {judgeError}</p>
            </div>
          </div>
        )}

        {!session ? (
          <div className="relative z-10 flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="text-6xl">🎯</div>
              <h2 className="text-xl font-semibold" style={{ color: 'var(--text-secondary)' }}>No active session</h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Create and activate a session in Admin to begin</p>
              <Link href="/admin" className="inline-block mt-2 text-sm underline underline-offset-4"
                style={{ color: 'var(--accent)' }}>
                Go to Admin →
              </Link>
            </div>
          </div>
        ) : (
          <div className="relative z-10 flex flex-col flex-1 overflow-hidden min-h-0">

            {/* Session + controls strip */}
            <div className="relative shrink-0 flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5"
              style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-glass)' }}>

              {/* Current session label */}
              <span className="text-xs font-bold tracking-widest uppercase shrink-0" style={{ color: 'var(--text-muted)' }}>
                Session
              </span>
              <span className="h-1.5 w-1.5 rounded-full shrink-0"
                style={{ background: activeTeam ? 'var(--accent)' : 'var(--text-muted)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {activeTeam?.name ?? 'Press Record to begin'}
              </span>

              {/* Punctuate button — visible only while recording */}
              <AnimatePresence>
                {isRecording && activeTeam && (
                  <motion.div
                    key="punctuate-zone"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex items-center"
                  >
                    {confirmPunctuate ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Snapshot &amp; start fresh?</span>
                        <button
                          onClick={handlePunctuate}
                          disabled={isSummarising || isPunctuating}
                          className="text-xs px-2.5 py-1 rounded-lg font-medium disabled:opacity-50"
                          style={{ background: 'var(--accent)', color: 'white' }}>
                          {isPunctuating ? '…' : 'Yes'}
                        </button>
                        <button
                          onClick={() => setConfirmPunctuate(false)}
                          className="text-xs px-2.5 py-1 rounded-lg"
                          style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmPunctuate(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                        style={{ color: 'var(--text-muted)', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hover)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                          <line x1="4" y1="22" x2="4" y2="15" />
                        </svg>
                        Punctuate
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Collector mics pill */}
              <AnimatePresence>
                {collectors.length > 0 && (
                  <motion.div
                    key="collectors"
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--score-high)', border: '1px solid rgba(16,185,129,0.25)' }}
                  >
                    <span className="relative flex h-1.5 w-1.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'currentColor' }} />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: 'currentColor' }} />
                    </span>
                    {collectors.length} mic{collectors.length !== 1 ? 's' : ''}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Capture mode toggle + Record button */}
              <div className="ml-auto shrink-0 flex items-center gap-2">
                <div className="hidden sm:flex rounded-lg overflow-hidden text-xs font-medium shrink-0"
                  style={{ border: '1px solid var(--border)', opacity: isRecording ? 0.4 : 1, pointerEvents: isRecording ? 'none' : 'auto' }}>
                  {([
                    { value: 'local' as const, label: 'Local', icon: (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" />
                      </svg>
                    )},
                    { value: 'online' as const, label: 'Meeting', icon: (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <rect x="2" y="7" width="15" height="12" rx="2" />
                        <path d="M17 11l4-3v8l-4-3" />
                      </svg>
                    )},
                  ]).map(({ value, label, icon }) => (
                    <button key={value} onClick={() => setMode(value)}
                      className="flex items-center gap-1 px-2.5 py-1.5 transition-all"
                      style={{
                        background: captureMode === value ? 'var(--accent-dim)' : 'transparent',
                        color: captureMode === value ? 'var(--accent)' : 'var(--text-muted)',
                        borderRight: value === 'local' ? '1px solid var(--border)' : 'none',
                      }}>
                      {icon}{label}
                    </button>
                  ))}
                </div>
                <RecordingControl compact onStart={start} onStop={stop} />
              </div>
            </div>

            {/* Session transition flash */}
            <AnimatePresence>
              {showTransition && activeTeam && (
                <motion.div
                  key="transition"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="absolute left-0 right-0 z-30 flex items-center justify-center py-3 pointer-events-none"
                  style={{ top: '88px', background: 'linear-gradient(180deg, var(--bg) 0%, transparent 100%)' }}
                >
                  <div className="flex items-center gap-3 px-6 py-3 rounded-2xl"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-hover)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
                    <span className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>Now recording</span>
                    <span className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{activeTeam.name}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Mobile tab bar */}
            <div className="flex md:hidden shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-glass)' }}>
              {(['scores', 'summary'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setMobileTab(tab)}
                  className="flex-1 py-2.5 text-xs font-semibold capitalize transition-colors"
                  style={{
                    color: mobileTab === tab ? 'var(--accent)' : 'var(--text-muted)',
                    borderBottom: `2px solid ${mobileTab === tab ? 'var(--accent)' : 'transparent'}`,
                  }}
                >
                  {tab === 'scores' ? 'Scores' : 'Summary'}
                </button>
              ))}
            </div>

            {/* Score bars */}
            <div className={`flex-1 overflow-hidden min-h-0 ${mobileTab === 'summary' ? 'hidden md:flex md:flex-col' : ''}`}>
              <ScorePanel fullscreen />
            </div>

            {/* AI summary */}
            <div
              className={`overflow-hidden md:shrink-0 ${mobileTab === 'scores' ? 'hidden md:block' : 'flex-1 min-h-0'}`}
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <TranscriptSummary fullHeight={mobileTab === 'summary'} />
            </div>

            {/* Live ticker */}
            <TranscriptTicker />

          </div>
        )}
      </div>
    </ThemeProvider>
  )
}

function NavLink({ href, label, icon, target }: { href: string; label: string; icon: string; target?: string }) {
  return (
    <Link href={href} target={target}
      className="flex items-center gap-1.5 text-base px-2.5 py-1.5 rounded-md transition-colors small-caps"
      style={{ color: 'var(--text-muted)' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}>
      {icon === 'external' ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      ) : icon === 'mic' ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      ) : icon === 'archive' ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="21 8 21 21 3 21 3 8" />
          <rect x="1" y="3" width="22" height="5" />
          <line x1="10" y1="12" x2="14" y2="12" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41M12 2v2M12 20v2M2 12h2M20 12h2" />
        </svg>
      )}
      {label}
    </Link>
  )
}
