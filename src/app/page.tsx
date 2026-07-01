'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { createClient } from '@/lib/supabase'
import { TeamSelector } from '@/components/TeamSelector'
import { TranscriptSummary } from '@/components/TranscriptSummary'
import { TranscriptTicker } from '@/components/TranscriptTicker'
import { ScorePanel } from '@/components/ScorePanel'
import { RecordingControl } from '@/components/RecordingControl'
import { ThemeSelector, ThemeProvider } from '@/components/ThemeSelector'
import { useAudioCapture } from '@/hooks/useAudioCapture'
import { useSessionPresence } from '@/hooks/useSessionPresence'
import { getDeviceId } from '@/lib/deviceId'

export default function JudgePage() {
  const { session, setSession, setTeams, setCriteria, updateScore, setThemeId } = useAppStore()
  const activeTeam = useAppStore((s) => s.activeTeam)
  const teams = useAppStore((s) => s.teams)
  const isRecording = useAppStore((s) => s.isRecording)
  const isSummarising = useAppStore((s) => s.isSummarising)
  const judgeError = useAppStore((s) => s.judgeError)
  const [prevTeamName, setPrevTeamName] = useState<string | null>(null)
  const [showTransition, setShowTransition] = useState(false)
  const [missingKeys, setMissingKeys] = useState<string[]>([])
  const [confirmNext, setConfirmNext] = useState(false)
  const [confirmAutoAdvance, setConfirmAutoAdvance] = useState(false)
  const [mobileTab, setMobileTab] = useState<'scores' | 'summary'>('scores')
  const [showAddTeamInline, setShowAddTeamInline] = useState(false)
  const [newTeamNameInline, setNewTeamNameInline] = useState('')
  const [addingTeamInline, setAddingTeamInline] = useState(false)
  const { start, stop, advanceToNextTeam, manualAdvanceAutoMode } = useAudioCapture()
  const deviceId = getDeviceId()
  const { peers } = useSessionPresence(session?.id ?? null, deviceId, 'judge', isRecording)
  const collectors = peers.filter((p) => p.role === 'collector')

  // Flash transition banner when team changes
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

      const [{ data: teams }, { data: criteria }] = await Promise.all([
        supabase.from('teams').select('*').eq('session_id', sess.id).order('order_index'),
        supabase.from('criteria').select('*').eq('session_id', sess.id).order('order_index'),
      ])

      if (teams) setTeams(teams)
      if (criteria) setCriteria(criteria)
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

  const addTeamInline = async () => {
    if (!newTeamNameInline.trim() || !session) return
    setAddingTeamInline(true)
    const supabase = createClient()
    const { data } = await supabase.from('teams').insert({
      session_id: session.id, name: newTeamNameInline.trim(), order_index: teams.length,
    }).select().single()
    if (data) {
      setTeams([...teams, data])
      setNewTeamNameInline('')
      setShowAddTeamInline(false)
    }
    setAddingTeamInline(false)
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
          style={{ borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(8px)' }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--gradient-from), var(--gradient-to))' }}>
              <span className="text-[9px] font-black text-white">AJ</span>
            </div>
            <span className="text-sm font-bold gradient-text shrink-0">AudioJudge</span>
            {session && (
              <>
                <span className="hidden sm:inline" style={{ color: 'var(--text-muted)' }}>·</span>
                <span className="hidden sm:inline text-sm truncate" style={{ color: 'var(--text-muted)' }}>{session.name}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-3">
              <ThemeSelector />
              <div className="w-px h-4" style={{ background: 'var(--border)' }} />
              <NavLink href="/display" target="_blank" label="Display" icon="external" />
              <NavLink href="/collect" target="_blank" label="Collect" icon="mic" />
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

            {/* Participant + recording strip */}
            <div className="relative shrink-0 flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5"
              style={{ borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}>
              {session?.detection_mode === 'automatic' ? (
                <>
                  <span className="text-[10px] font-bold tracking-widest uppercase shrink-0" style={{ color: 'var(--text-muted)' }}>
                    Auto
                  </span>
                  <div className="flex-1 flex items-center gap-2 overflow-hidden">
                    <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: 'var(--accent)' }} />
                    <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {activeTeam?.name ?? 'Waiting for presenter…'}
                    </span>
                  </div>
                  {/* Manual fallback advance — auto mode only, visible when recording */}
                  {isRecording && activeTeam && (
                    confirmAutoAdvance ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Score &amp; next?</span>
                        <button
                          onClick={async () => { setConfirmAutoAdvance(false); await manualAdvanceAutoMode() }}
                          disabled={isSummarising}
                          className="text-xs px-2.5 py-1 rounded-lg font-medium disabled:opacity-50"
                          style={{ background: 'var(--accent)', color: 'white' }}>
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmAutoAdvance(false)}
                          className="text-xs px-2.5 py-1 rounded-lg"
                          style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmAutoAdvance(true)}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                        style={{ color: 'var(--text-muted)', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hover)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}>
                        Next presenter
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>
                    )
                  )}
                </>
              ) : (
                <>
                  <span className="text-[10px] font-bold tracking-widest uppercase shrink-0" style={{ color: 'var(--text-muted)' }}>
                    Evaluating
                  </span>
                  <div className="flex-1 overflow-hidden">
                    <TeamSelector />
                  </div>
                  {/* Inline add participant */}
                  {showAddTeamInline ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        autoFocus
                        value={newTeamNameInline}
                        onChange={e => setNewTeamNameInline(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addTeamInline(); if (e.key === 'Escape') { setShowAddTeamInline(false); setNewTeamNameInline('') } }}
                        placeholder="Participant name…"
                        className="w-36 px-2.5 py-1 rounded-lg text-xs focus:outline-none"
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border-hover)', color: 'var(--text-primary)' }}
                      />
                      <button onClick={addTeamInline} disabled={addingTeamInline || !newTeamNameInline.trim()}
                        className="text-xs px-2.5 py-1 rounded-lg font-medium disabled:opacity-50"
                        style={{ background: 'var(--accent)', color: 'white' }}>
                        {addingTeamInline ? '…' : 'Add'}
                      </button>
                      <button onClick={() => { setShowAddTeamInline(false); setNewTeamNameInline('') }}
                        className="text-xs px-2 py-1 rounded-lg"
                        style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAddTeamInline(true)}
                      className="shrink-0 flex items-center justify-center w-7 h-7 rounded-full transition-all"
                      style={{ color: 'var(--text-muted)', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)' }}
                      title="Add participant"
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hover)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </button>
                  )}
                  {/* Next presenter button — manual mode only */}
                  {activeTeam && teams.findIndex(t => t.id === activeTeam.id) < teams.length - 1 && (
                    confirmNext ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Score &amp; advance?</span>
                        <button
                          onClick={async () => { setConfirmNext(false); await advanceToNextTeam() }}
                          disabled={isSummarising}
                          className="text-xs px-2.5 py-1 rounded-lg font-medium disabled:opacity-50"
                          style={{ background: 'var(--accent)', color: 'white' }}>
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmNext(false)}
                          className="text-xs px-2.5 py-1 rounded-lg"
                          style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmNext(true)}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                        style={{ color: 'var(--text-muted)', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hover)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}>
                        Next presenter
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>
                    )
                  )}
                </>
              )}
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
              <div className="ml-auto shrink-0">
                <RecordingControl compact onStart={start} onStop={stop} />
              </div>
            </div>

            {/* Presenter transition flash */}
            <AnimatePresence>
              {showTransition && activeTeam && (
                <motion.div
                  key="transition"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="absolute left-0 right-0 z-30 flex items-center justify-center py-3 pointer-events-none"
                  style={{
                    top: '88px',
                    background: 'linear-gradient(180deg, var(--bg) 0%, transparent 100%)',
                  }}
                >
                  <div className="flex items-center gap-3 px-6 py-3 rounded-2xl"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-hover)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
                    <span className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>Now evaluating</span>
                    <span className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{activeTeam.name}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Mobile tab bar — hidden on desktop */}
            <div className="flex md:hidden shrink-0" style={{ borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.15)' }}>
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

            {/* Score bars — hero element; hidden on mobile when summary tab active */}
            <div className={`flex-1 overflow-hidden min-h-0 ${mobileTab === 'summary' ? 'hidden md:flex md:flex-col' : ''}`}>
              <ScorePanel fullscreen />
            </div>

            {/* AI summary — desktop: fixed 130px strip; mobile: fills space in summary tab */}
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
      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-colors"
      style={{ color: 'var(--text-muted)' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}>
      {icon === 'external' ? (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      ) : icon === 'mic' ? (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      ) : (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41M12 2v2M12 20v2M2 12h2M20 12h2" />
        </svg>
      )}
      {label}
    </Link>
  )
}
