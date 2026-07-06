'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, useSpring } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import { useAppStore } from '@/lib/store'
import { createClient } from '@/lib/supabase'
import { ThemeProvider } from '@/components/ThemeSelector'
import AppHeader from '@/components/AppHeader'
import { RecordingControl } from '@/components/RecordingControl'
import { useAudioCapture } from '@/hooks/useAudioCapture'
import type { CaptureMode } from '@/hooks/useCollectorCapture'

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0)
  const spring = useSpring(0, { stiffness: 45, damping: 18 })
  useEffect(() => {
    spring.set(value)
    return spring.on('change', (v) => setDisplay(Math.round(v)))
  }, [value, spring])
  return <>{display}</>
}

function getBarStyle(score: number) {
  if (score >= 70) return { color: 'var(--score-high)', glow: 'var(--glow-high)' }
  if (score >= 40) return { color: 'var(--score-mid)', glow: 'var(--glow-mid)' }
  return { color: 'var(--score-low)', glow: 'var(--glow-low)' }
}

function ScoreOverrideInput({ criteriaId, current, onClose }: { criteriaId: string; current: number; onClose: () => void }) {
  const [value, setValue] = useState(String(current || ''))
  const [saving, setSaving] = useState(false)
  const { event, activeSession, updateScore } = useAppStore.getState()

  const save = async () => {
    const num = parseInt(value, 10)
    if (isNaN(num) || num < 0 || num > 100) return
    if (!event || !activeSession) return
    setSaving(true)
    const res = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: event.id, teamId: activeSession.id, criteriaId, score: num, reasoning: 'Manual override' }),
    })
    if (res.ok) {
      updateScore({ criteria_id: criteriaId, score: num, reasoning: 'Manual override', team_id: activeSession.id, session_id: event.id, id: '', updated_at: '' })
    }
    setSaving(false)
    onClose()
  }

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
      className="flex items-center gap-2 mt-1">
      <input
        type="number" min={0} max={100} value={value} onChange={e => setValue(e.target.value)}
        autoFocus
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onClose() }}
        className="w-16 px-2 py-1 rounded-lg text-sm text-center font-bold tabular-nums focus:outline-none"
        style={{ background: 'var(--input-bg)', border: '1px solid var(--border-hover)', color: 'var(--text-primary)' }}
      />
      <button onClick={save} disabled={saving}
        className="text-xs px-2 py-1 rounded-lg font-medium disabled:opacity-40"
        style={{ background: 'var(--accent)', color: 'white' }}>
        {saving ? '…' : 'Set'}
      </button>
      <button onClick={onClose} className="text-xs px-2 py-1 rounded-lg"
        style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
        Cancel
      </button>
    </motion.div>
  )
}

export default function JudgePage() {
  const { event, setEvent, setSessions, setCriteria, updateScore, setActiveSession, setScores, patchActiveSession } = useAppStore()
  const activeSession = useAppStore((s) => s.activeSession)
  const sessions = useAppStore((s) => s.sessions)
  const isRecording = useAppStore((s) => s.isRecording)
  const isSummarising = useAppStore((s) => s.isSummarising)
  const judgeError = useAppStore((s) => s.judgeError)
  const criteria = useAppStore((s) => s.criteria)
  const scores = useAppStore((s) => s.scores)
  const transcript = useAppStore((s) => s.transcript)
  const interimTranscript = useAppStore((s) => s.interimTranscript)

  const [prevSessionName, setPrevSessionName] = useState<string | null>(null)
  const [showTransition, setShowTransition] = useState(false)
  const [missingKeys, setMissingKeys] = useState<string[]>([])
  const [confirmPunctuate, setConfirmPunctuate] = useState(false)
  const [isPunctuating, setIsPunctuating] = useState(false)
  const [captureMode, setCaptureMode] = useState<CaptureMode>(() => {
    try { return (localStorage.getItem('aj_capture_mode') as CaptureMode) ?? 'local' } catch { return 'local' }
  })
  const [clock, setClock] = useState(new Date())
  const [editingCriteriaId, setEditingCriteriaId] = useState<string | null>(null)
  const [showTranscript, setShowTranscript] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const [showQR, setShowQR] = useState(false)
  const [showMeetingModal, setShowMeetingModal] = useState(false)
  const [showPresenterPanel, setShowPresenterPanel] = useState(false)
  const [showNewPresenter, setShowNewPresenter] = useState(false)
  const [newPresenterName, setNewPresenterName] = useState('')
  const [creatingPresenter, setCreatingPresenter] = useState(false)
  const [allEvents, setAllEvents] = useState<any[]>([])
  const [activatingEventId, setActivatingEventId] = useState<string | null>(null)
  const transcriptScrollRef = useRef<HTMLDivElement>(null)
  const [transcriptAutoScroll, setTranscriptAutoScroll] = useState(true)

  const { start, stop, pause, resume, isPaused, punctuate, rescore, clearBuffer } = useAudioCapture(captureMode)

  const setMode = (m: CaptureMode) => {
    setCaptureMode(m)
    try { localStorage.setItem('aj_capture_mode', m) } catch {}
  }

  const overall = useMemo(() => {
    const scored = criteria.filter((c) => (scores[c.id]?.score ?? 0) > 0)
    if (!scored.length) return 0
    const w = scored.reduce((s, c) => s + c.weight, 0)
    return Math.round(scored.reduce((s, c) => s + scores[c.id].score * c.weight, 0) / w)
  }, [criteria, scores])

  const circumference = 2 * Math.PI * 46
  const overallStyle = getBarStyle(overall)

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!activeSession) return
    if (prevSessionName && prevSessionName !== activeSession.name) {
      setShowTransition(true)
      const t = setTimeout(() => setShowTransition(false), 1800)
      return () => clearTimeout(t)
    }
    setPrevSessionName(activeSession.name)
  }, [activeSession?.id])

  useEffect(() => {
    if (activeSession) setPrevSessionName(activeSession.name)
  }, [activeSession?.name])

  useEffect(() => {
    fetch('/api/settings/check')
      .then(r => r.json())
      .then(d => { if (!d.ok) setMissingKeys(d.missing) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (event) return
    createClient().from('sessions').select('id, name, brief, created_at').order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setAllEvents(data) })
  }, [event])

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data: sess } = await supabase
        .from('sessions').select('*').eq('is_active', true).maybeSingle()
      if (!sess) return
      setEvent(sess)

      const [{ data: loadedSessions }, { data: loadedCriteria }] = await Promise.all([
        supabase.from('teams').select('*').eq('session_id', sess.id).order('order_index'),
        supabase.from('criteria').select('*').eq('session_id', sess.id).order('order_index'),
      ])

      if (loadedSessions) setSessions(loadedSessions)
      if (loadedCriteria) setCriteria(loadedCriteria)

      if (sess.active_team_id && loadedSessions) {
        const activeS = loadedSessions.find((t: any) => t.id === sess.active_team_id)
        if (activeS) {
          setActiveSession(activeS)
          const { data: existingScores } = await supabase.from('scores').select('*')
            .eq('session_id', sess.id).eq('team_id', activeS.id)
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
        if (payload.new?.is_active) setEvent(payload.new)
      })
      .subscribe()

    const unsub = useAppStore.subscribe((state) => {
      if (state.event && !scoreChannel) {
        scoreChannel = rt.channel('scores-live')
          .on('postgres_changes', {
            event: '*', schema: 'public', table: 'scores',
            filter: `session_id=eq.${state.event.id}`,
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

  // Auto-scroll transcript to bottom when new content arrives, unless user has scrolled up
  useEffect(() => {
    if (!transcriptAutoScroll || !showTranscript) return
    const el = transcriptScrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [transcript, interimTranscript, transcriptAutoScroll, showTranscript])

  // Re-enable auto-scroll when transcript panel opens
  useEffect(() => {
    if (showTranscript) setTranscriptAutoScroll(true)
  }, [showTranscript])

  const handleTranscriptScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60
    setTranscriptAutoScroll(nearBottom)
  }, [])

  const scrollTranscriptToLatest = useCallback(() => {
    const el = transcriptScrollRef.current
    if (el) el.scrollTop = el.scrollHeight
    setTranscriptAutoScroll(true)
  }, [])

  const activateEvent = async (ev: any) => {
    setActivatingEventId(ev.id)
    const supabase = createClient()
    await supabase.from('sessions').update({ is_active: false }).neq('id', ev.id)
    const { data } = await supabase.from('sessions').update({ is_active: true }).eq('id', ev.id).select().single()
    if (data) {
      setEvent(data)
      const [{ data: loadedSessions }, { data: loadedCriteria }] = await Promise.all([
        supabase.from('teams').select('*').eq('session_id', data.id).order('order_index'),
        supabase.from('criteria').select('*').eq('session_id', data.id).order('order_index'),
      ])
      if (loadedSessions) setSessions(loadedSessions)
      if (loadedCriteria) setCriteria(loadedCriteria)
      if (data.active_team_id && loadedSessions) {
        const activeS = loadedSessions.find((t: any) => t.id === data.active_team_id)
        if (activeS) setActiveSession(activeS)
      }
    }
    setActivatingEventId(null)
  }

  const createPresenter = async () => {
    const name = newPresenterName.trim()
    if (!name || !event) return
    setCreatingPresenter(true)
    const supabase = createClient()
    const { count } = await supabase.from('teams').select('*', { count: 'exact', head: true }).eq('session_id', event.id)
    const { data: newTeam, error } = await supabase
      .from('teams')
      .insert({ session_id: event.id, name, order_index: count ?? 0 })
      .select()
      .single()
    if (!error && newTeam) {
      await supabase.from('sessions').update({ active_team_id: newTeam.id }).eq('id', event.id)
      setActiveSession(newTeam)
      useAppStore.setState((s: any) => ({ sessions: [...s.sessions, newTeam] }))
      clearBuffer()
    }
    setCreatingPresenter(false)
    setShowNewPresenter(false)
    setNewPresenterName('')
  }

  const switchToPresenter = async (team: any) => {
    setShowPresenterPanel(false)
    if (team.id === activeSession?.id) return
    clearBuffer()
    setActiveSession(team)
    const supabase = createClient()
    const { data } = await supabase.from('scores').select('*')
      .eq('session_id', event!.id).eq('team_id', team.id)
    if (data?.length) {
      const map: Record<string, any> = {}
      data.forEach((s: any) => { map[s.criteria_id] = s })
      setScores(map)
    }
  }

  const handlePunctuate = async () => {
    setConfirmPunctuate(false)
    setIsPunctuating(true)
    await punctuate()
    setIsPunctuating(false)
  }

  const saveSessionName = async () => {
    const trimmed = nameValue.trim()
    setEditingName(false)
    if (!activeSession || !trimmed || trimmed === activeSession.name) return
    const supabase = createClient()
    const { error } = await supabase.from('teams').update({ name: trimmed }).eq('id', activeSession.id)
    if (!error) patchActiveSession({ name: trimmed })
  }

  return (
    <ThemeProvider>
      <div className="fixed inset-0 flex flex-col overflow-hidden" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>

        {/* Ambient */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <motion.div className="absolute top-0 left-1/3 w-[800px] h-[800px] rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 65%)' }}
            animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 10, repeat: Infinity }} />
          <motion.div className="absolute bottom-0 right-1/3 w-[600px] h-[600px] rounded-full opacity-[0.08]"
            style={{ background: 'radial-gradient(circle, var(--accent-secondary) 0%, transparent 65%)' }}
            animate={{ scale: [1.08, 1, 1.08] }} transition={{ duration: 10, repeat: Infinity }} />
        </div>

        {/* Missing API keys warning */}
        {missingKeys.length > 0 && (
          <div className="relative z-10 flex items-center justify-between gap-3 px-5 py-2"
            style={{ background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)' }}>
            <div className="flex items-center gap-2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p className="text-xs" style={{ color: '#f87171' }}>Missing API keys: {missingKeys.join(', ')} — scoring and transcription won't work.</p>
            </div>
            <Link href="/admin" className="text-xs font-medium underline underline-offset-2 shrink-0" style={{ color: '#f87171' }}>
              Add in Events →
            </Link>
          </div>
        )}

        {/* Judge error banner */}
        {judgeError && (
          <div className="relative z-10 flex items-center gap-3 px-5 py-2"
            style={{ background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p className="text-xs" style={{ color: '#f87171' }}>Scoring error: {judgeError}</p>
          </div>
        )}

        {/* Header */}
        <AppHeader
          items={[
            { label: 'Events', href: '/admin' },
            { label: "Let's Record", href: '/', active: true },
            { label: 'Records', href: '/records' },
          ]}
          rightSlot={<>
            {/* Clock */}
            <span className="text-sm tabular-nums" style={{ color: 'var(--text-muted)' }}>
              {clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>

            {/* Capture mode toggle */}
            <div className="flex rounded-lg overflow-hidden"
              style={{ border: '1px solid var(--border)', opacity: isRecording ? 0.35 : 1, pointerEvents: isRecording ? 'none' : 'auto' }}>
              <button onClick={() => setMode('local')} className="px-3 py-1.5 text-xs font-medium transition-all"
                style={{ background: captureMode === 'local' ? 'var(--accent-dim)' : 'transparent', color: captureMode === 'local' ? 'var(--accent)' : 'var(--text-muted)', borderRight: '1px solid var(--border)' }}>
                In-person
              </button>
              <button
                onClick={() => captureMode === 'online' ? setMode('local') : setShowMeetingModal(true)}
                className="px-3 py-1.5 text-xs font-medium transition-all"
                style={{ background: captureMode === 'online' ? 'var(--accent-dim)' : 'transparent', color: captureMode === 'online' ? 'var(--accent)' : 'var(--text-muted)' }}>
                Meeting
              </button>
            </div>

            {/* Punctuate */}
            <AnimatePresence>
              {isRecording && activeSession && (
                <motion.div key="punctuate" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                  {confirmPunctuate ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Snapshot &amp; start fresh?</span>
                      <button onClick={handlePunctuate} disabled={isSummarising || isPunctuating}
                        className="text-xs px-2.5 py-1 rounded-lg font-medium disabled:opacity-50"
                        style={{ background: 'var(--accent)', color: 'white' }}>
                        {isPunctuating ? '…' : 'Yes'}
                      </button>
                      <button onClick={() => setConfirmPunctuate(false)}
                        className="text-xs px-2.5 py-1 rounded-lg"
                        style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmPunctuate(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                      style={{ color: 'var(--text-muted)', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hover)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                        <line x1="4" y1="22" x2="4" y2="15" />
                      </svg>
                      Punctuate
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* New presenter */}
            <AnimatePresence>
              {!isRecording && !isPaused && !!event && (
                <motion.button
                  key="new-presenter"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={() => { setShowNewPresenter(true); setNewPresenterName('') }}
                  title="Create a new presenter slot"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                  style={{ color: 'var(--text-muted)', border: '1px solid var(--border)', background: 'transparent' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hover)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  New Presenter
                </motion.button>
              )}
            </AnimatePresence>

            <RecordingControl compact onStart={start} onStop={stop} onPause={pause} onResume={resume} isPausedOverride={isPaused} />

            {/* Separator */}
            <div className="w-px h-4 shrink-0" style={{ background: 'var(--border)' }} />

            {/* QR code button */}
            <button
              onClick={() => setShowQR(v => !v)}
              title="Show collector QR code"
              className="p-1.5 rounded-lg transition-all"
              style={{ color: showQR ? 'var(--accent)' : 'var(--text-muted)', background: showQR ? 'var(--accent-dim)' : 'transparent', border: '1px solid var(--border)' }}
              onMouseEnter={e => { if (!showQR) (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)' }}
              onMouseLeave={e => { if (!showQR) (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <path d="M14 14h2v2h-2zM18 14h3M14 18v3M18 18h3v3h-3z"/>
              </svg>
            </button>

            {/* Presenter list panel toggle */}
            {!!event && (
              <button
                onClick={() => setShowPresenterPanel(v => !v)}
                title="Browse presenters"
                className="p-1.5 rounded-lg transition-all"
                style={{ color: showPresenterPanel ? 'var(--accent)' : 'var(--text-muted)', background: showPresenterPanel ? 'var(--accent-dim)' : 'transparent', border: '1px solid var(--border)' }}
                onMouseEnter={e => { if (!showPresenterPanel) (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)' }}
                onMouseLeave={e => { if (!showPresenterPanel) (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                  <circle cx="3" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="3" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="3" cy="18" r="1" fill="currentColor" stroke="none"/>
                </svg>
              </button>
            )}
          </>}
        />

        {/* Body */}
        {!event ? (
          <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-10">
            <div className="w-full max-w-sm space-y-6">
              <div className="text-center space-y-1">
                <p className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Select an event</p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Go live to start scoring</p>
              </div>
              {allEvents.length === 0 ? (
                <div className="text-center py-8 space-y-3">
                  <div className="text-5xl">🎯</div>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No events yet</p>
                  <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl"
                    style={{ background: 'var(--accent)', color: 'white' }}>
                    Create an event
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {allEvents.map((ev) => (
                    <button
                      key={ev.id}
                      onClick={() => activateEvent(ev)}
                      disabled={!!activatingEventId}
                      className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-left transition-all disabled:opacity-50"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hover)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{ev.name}</p>
                        {ev.brief && <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{ev.brief}</p>}
                      </div>
                      {activatingEventId === ev.id ? (
                        <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin shrink-0"
                          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
                      ) : (
                        <span className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--border-hover)' }}>
                          Go live
                        </span>
                      )}
                    </button>
                  ))}
                  <div className="pt-2 text-center">
                    <Link href="/admin" className="text-xs underline underline-offset-2" style={{ color: 'var(--text-muted)' }}>
                      Manage events →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : !activeSession ? (
          <div className="relative z-0 flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-6">
              <div className="text-7xl">🎤</div>
              <div className="text-center space-y-2">
                <p className="text-2xl font-light" style={{ color: 'var(--text-primary)' }}>Ready when you are</p>
                <p className="text-base" style={{ color: 'var(--text-muted)' }}>Create a presenter slot to begin scoring</p>
              </div>
              <button
                onClick={() => { setShowNewPresenter(true); setNewPresenterName('') }}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold"
                style={{ background: 'var(--accent)', color: 'white', boxShadow: '0 4px 24px var(--glow-accent)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                New Presenter
              </button>
            </div>
          </div>
        ) : (
          <div className="relative z-0 flex-1 flex flex-col min-h-0 px-12 pt-6 pb-6">

            {/* Content row */}
            <div className="flex gap-12 flex-1 min-h-0">

              {/* Left: heading + criteria bars */}
              <div className="flex-1 flex flex-col min-h-0">

                {/* Team name */}
                <AnimatePresence mode="wait">
                  <motion.div key={activeSession.id} initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }} className="mb-8 shrink-0">
                    <p className="text-base font-bold tracking-widest uppercase mb-2" style={{ color: 'var(--text-muted)' }}>
                      Now Presenting
                    </p>
                    {editingName ? (
                      <input
                        value={nameValue}
                        onChange={e => setNameValue(e.target.value)}
                        autoFocus
                        onBlur={saveSessionName}
                        onKeyDown={e => { if (e.key === 'Enter') saveSessionName(); if (e.key === 'Escape') setEditingName(false) }}
                        className="text-6xl font-black tracking-tight bg-transparent border-b-2 outline-none w-full"
                        style={{ borderColor: 'var(--accent)', color: 'var(--text-primary)' }}
                      />
                    ) : (
                      <h1
                        className="text-6xl font-black tracking-tight gradient-text cursor-pointer"
                        onClick={() => { setNameValue(activeSession.name); setEditingName(true) }}
                        title="Click to rename"
                      >{activeSession.name}</h1>
                    )}
                    {activeSession.description && (
                      <p className="text-lg mt-2" style={{ color: 'var(--text-muted)' }}>{activeSession.description}</p>
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* Criteria bars */}
                <div className="flex-1 overflow-y-auto pr-4 flex flex-col">
                <div className="my-auto space-y-6 py-2">
                {criteria.length === 0 ? (
                  <div className="flex flex-col items-center text-center gap-5 px-8 py-10 rounded-2xl mx-auto w-full max-w-sm"
                    style={{ border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                    <div className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="22" />
                      </svg>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>No scoring criteria</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Define what you're judging before you start recording</p>
                    </div>
                    <Link
                      href={`/admin?event=${event?.id ?? ''}`}
                      className="text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                      style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--border-hover)' }}
                    >
                      Set up in Events →
                    </Link>
                  </div>
                ) : criteria.map((c, i) => {
                  const score = scores[c.id]?.score ?? 0
                  const s = getBarStyle(score)
                  return (
                    <motion.div key={c.id} initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-base font-bold tracking-widest uppercase" style={{ color: 'var(--text-secondary)' }}>
                          {c.name}
                        </span>
                        <div
                          className={`flex items-baseline gap-1 ${score > 0 ? 'cursor-pointer rounded-xl px-1 -mx-1 transition-colors hover:bg-white/5' : ''}`}
                          onClick={() => score > 0 ? setEditingCriteriaId(editingCriteriaId === c.id ? null : c.id) : undefined}
                          title={score > 0 ? 'Click to override score' : undefined}
                        >
                          <span className="text-3xl font-black tabular-nums" style={{ color: score > 0 ? s.color : 'var(--text-muted)' }}>
                            {score > 0 ? <AnimatedNumber value={score} /> : '—'}
                          </span>
                          {score > 0 && <span className="text-base" style={{ color: 'var(--text-muted)' }}>/100</span>}
                        </div>
                      </div>
                      <div className="relative h-5 rounded-full overflow-hidden" style={{ background: 'var(--bar-track)' }}>
                        <motion.div className="absolute inset-y-0 left-0 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: score > 0 ? `${score}%` : '0%' }}
                          transition={{ type: 'spring', stiffness: 40, damping: 14 }}
                          style={{
                            background: score > 0
                              ? `linear-gradient(90deg, color-mix(in srgb, ${s.color} 60%, transparent), ${s.color})`
                              : 'transparent',
                            boxShadow: score > 0 ? `0 0 24px ${s.glow}` : 'none',
                          }} />
                      </div>
                      {scores[c.id]?.reasoning && (
                        <p className="text-base" style={{ color: 'var(--text-muted)' }}>{scores[c.id].reasoning}</p>
                      )}
                      <AnimatePresence>
                        {editingCriteriaId === c.id && (
                          <ScoreOverrideInput
                            criteriaId={c.id}
                            current={scores[c.id]?.score ?? 0}
                            onClose={() => setEditingCriteriaId(null)}
                          />
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )
                })}
                </div>{/* end my-auto wrapper */}
                </div>{/* end criteria scroll */}

              </div>{/* end left col */}

              {/* Right column: gauge (top) + transcript toggle (bottom) */}
              <div className="w-64 shrink-0 flex flex-col min-h-0">

                {/* Overall gauge — anchored top */}
                <div className="flex flex-col items-center shrink-0">
                  <p className="text-base font-bold tracking-widest uppercase mb-6" style={{ color: 'var(--text-muted)' }}>
                    Overall
                  </p>
                  <div className="relative w-56 h-56">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 110 110">
                      <circle cx="55" cy="55" r="46" fill="none" strokeWidth="8" style={{ stroke: 'var(--ring-track)' }} />
                      <motion.circle
                        cx="55" cy="55" r="46" fill="none" strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={circumference}
                        initial={{ strokeDashoffset: circumference }}
                        animate={{ strokeDashoffset: circumference * (1 - overall / 100) }}
                        transition={{ type: 'spring', stiffness: 35, damping: 14 }}
                        style={{
                          stroke: overallStyle.color,
                          filter: overall > 0 ? `drop-shadow(0 0 10px ${overallStyle.color})` : 'none',
                        }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-7xl font-black tabular-nums leading-none" style={{ color: overallStyle.color }}>
                        {overall > 0 ? <AnimatedNumber value={overall} /> : '—'}
                      </span>
                      {overall > 0 && <span className="text-lg mt-1" style={{ color: 'var(--text-muted)' }}>/100</span>}
                    </div>
                    {/* Rescore button — top-right of circle */}
                    <AnimatePresence>
                      {!isRecording && !isPaused && activeSession && (
                        <motion.button
                          key="rescore-btn"
                          initial={{ opacity: 0, scale: 0.7 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.7 }}
                          onClick={rescore}
                          disabled={isSummarising}
                          title="Rescore from full transcript"
                          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-40 transition-opacity"
                          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hover)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
                        >
                          {isSummarising ? (
                            <div className="w-3.5 h-3.5 rounded-full border border-current border-t-transparent animate-spin" />
                          ) : (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                              <path d="M3 3v5h5" />
                            </svg>
                          )}
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Expandable transcript — fills remaining space, button always visible at bottom */}
                <div className="flex-1 min-h-0 flex flex-col items-end justify-end gap-2 pt-4">
                  <AnimatePresence>
                    {showTranscript && (
                      <motion.div
                        key="transcript-panel"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={{ duration: 0.18 }}
                        className="relative w-full rounded-xl overflow-hidden flex flex-col min-h-0"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                      >
                        <div
                          ref={transcriptScrollRef}
                          onScroll={handleTranscriptScroll}
                          className="overflow-y-auto p-4 relative"
                          style={{ maxHeight: 'min(400px, calc(100vh - 340px))' }}
                        >
                          {isRecording && (
                            <div className="flex items-center gap-1.5 mb-3">
                              <span className="relative flex h-1.5 w-1.5 shrink-0">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--score-low)' }} />
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: 'var(--score-low)' }} />
                              </span>
                              <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--score-low)' }}>Live</span>
                            </div>
                          )}
                          <p className="text-xs font-mono leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                            {transcript
                              ? <>{transcript}{interimTranscript && <span className="italic opacity-50"> {interimTranscript}</span>}</>
                              : isRecording
                                ? <span style={{ color: 'var(--text-muted)' }}>Listening…</span>
                                : <span style={{ color: 'var(--text-muted)' }}>Transcript will appear once recording starts</span>
                            }
                          </p>
                        </div>
                        {/* Jump to latest button — shown when user has scrolled up */}
                        <AnimatePresence>
                          {!transcriptAutoScroll && (
                            <motion.div
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 4 }}
                              transition={{ duration: 0.15 }}
                              className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none"
                            >
                              <button
                                onClick={scrollTranscriptToLatest}
                                className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg"
                                style={{ background: 'var(--accent)', color: 'white' }}
                              >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                  <polyline points="6 9 12 15 18 9" />
                                </svg>
                                Jump to latest
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <button
                    onClick={() => setShowTranscript(v => !v)}
                    title={showTranscript ? 'Close transcript' : 'Show live transcript'}
                    className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xl font-light transition-all"
                    style={{
                      background: showTranscript ? 'var(--accent)' : 'var(--bg-card)',
                      color: showTranscript ? 'white' : 'var(--text-muted)',
                      border: `1px solid ${showTranscript ? 'transparent' : 'var(--border)'}`,
                    }}
                  >
                    {showTranscript ? '×' : '+'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* New Presenter modal */}
        <AnimatePresence>
          {showNewPresenter && (
            <motion.div
              key="new-presenter-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.6)' }}
              onClick={() => setShowNewPresenter(false)}
            >
              <motion.div
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.92, opacity: 0 }}
                transition={{ duration: 0.16 }}
                className="rounded-2xl p-7 max-w-sm w-full mx-4 flex flex-col gap-5"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}
                onClick={e => e.stopPropagation()}
              >
                <h2 className="text-base font-bold">New Presenter</h2>
                <input
                  autoFocus
                  value={newPresenterName}
                  onChange={e => setNewPresenterName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') createPresenter(); if (e.key === 'Escape') setShowNewPresenter(false) }}
                  placeholder="Presenter / team name"
                  className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--border-hover)', color: 'var(--text-primary)' }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={createPresenter}
                    disabled={!newPresenterName.trim() || creatingPresenter}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 transition-all"
                    style={{ background: 'var(--accent)', color: 'white' }}
                  >
                    {creatingPresenter ? 'Creating…' : 'Create'}
                  </button>
                  <button
                    onClick={() => setShowNewPresenter(false)}
                    className="px-4 py-2.5 rounded-xl text-sm transition-all"
                    style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Meeting mode modal */}
        <AnimatePresence>
          {showMeetingModal && (
            <motion.div
              key="meeting-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.6)' }}
              onClick={() => setShowMeetingModal(false)}
            >
              <motion.div
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.92, opacity: 0 }}
                transition={{ duration: 0.16 }}
                className="rounded-2xl p-7 max-w-sm w-full mx-4 flex flex-col gap-5"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center mt-0.5"
                    style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2">
                      <rect x="2" y="7" width="15" height="12" rx="2" /><path d="M17 11l4-3v8l-4-3" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-base font-bold mb-1">Meeting mode</h2>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                      This captures audio from a browser tab rather than a physical microphone.
                    </p>
                  </div>
                </div>

                <ul className="space-y-2.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0 font-bold" style={{ color: 'var(--accent)' }}>1.</span>
                    Start your video call in a separate Chrome tab before pressing Record.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0 font-bold" style={{ color: 'var(--accent)' }}>2.</span>
                    When the browser asks what to share, select that meeting tab.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0 font-bold" style={{ color: 'var(--accent)' }}>3.</span>
                    Make sure <strong style={{ color: 'var(--text-primary)' }}>"Share tab audio"</strong> is ticked — it's off by default.
                  </li>
                </ul>

                <p className="text-xs px-3 py-2 rounded-lg" style={{ color: '#93c5fd', background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.18)' }}>
                  Chrome only. This won't work in Safari or Firefox.
                </p>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => { setMode('online'); setShowMeetingModal(false) }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                    style={{ background: 'var(--accent)', color: 'white' }}>
                    Got it — use meeting mode
                  </button>
                  <button
                    onClick={() => setShowMeetingModal(false)}
                    className="px-4 py-2.5 rounded-xl text-sm transition-all"
                    style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                    Cancel
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* QR modal */}
        <AnimatePresence>
          {showQR && (
            <motion.div
              key="qr-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
              onClick={() => setShowQR(false)}
            >
              <motion.div
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.92, opacity: 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="rounded-3xl p-8 flex flex-col items-center gap-5"
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border-hover)',
                  boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
                  minWidth: '300px',
                }}
                onClick={e => e.stopPropagation()}
              >
                <p className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>Scan to open</p>
                <div className="rounded-2xl p-4" style={{ background: '#ffffff' }}>
                  <QRCodeSVG value="https://audiojudge.awoken.dev/collect" size={180} />
                </div>
                <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>audiojudge.awoken.dev/collect</p>
                <button
                  onClick={() => setShowQR(false)}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hover)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
                >
                  Close
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Presenter list panel */}
        <AnimatePresence>
          {showPresenterPanel && (
            <>
              <motion.div
                key="presenter-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 z-40"
                style={{ background: 'rgba(0,0,0,0.35)' }}
                onClick={() => setShowPresenterPanel(false)}
              />
              <motion.div
                key="presenter-panel"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', stiffness: 340, damping: 32 }}
                className="fixed right-0 top-0 bottom-0 z-50 flex flex-col"
                style={{ width: '280px', background: 'var(--bg)', borderLeft: '1px solid var(--border)' }}
              >
                {/* Panel header */}
                <div className="flex items-center justify-between px-5 shrink-0"
                  style={{ height: '56px', borderBottom: '1px solid var(--border)' }}>
                  <span className="text-sm font-bold tracking-wide">Presenters</span>
                  <button
                    onClick={() => setShowPresenterPanel(false)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-lg font-light transition-all"
                    style={{ color: 'var(--text-muted)', background: 'transparent' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-card)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >×</button>
                </div>

                {/* Presenter list */}
                <div className="flex-1 overflow-y-auto py-2">
                  {sessions.length === 0 ? (
                    <p className="px-5 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                      No presenters yet
                    </p>
                  ) : sessions.map((team: any) => {
                    const isActive = team.id === activeSession?.id
                    const disabled = isRecording && !isActive
                    return (
                      <button
                        key={team.id}
                        onClick={() => switchToPresenter(team)}
                        disabled={disabled}
                        className="w-full text-left px-4 py-3 flex items-center gap-3 transition-all disabled:opacity-30"
                        style={{ background: isActive ? 'var(--accent-dim)' : 'transparent' }}
                        onMouseEnter={e => { if (!disabled && !isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg-card)' }}
                        onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: isActive ? 'var(--accent)' : 'var(--border-hover)' }}
                        />
                        <span
                          className="text-sm font-medium truncate"
                          style={{ color: isActive ? 'var(--accent)' : 'var(--text-primary)' }}
                        >
                          {team.name}
                        </span>
                        {isActive && isRecording && (
                          <span className="ml-auto shrink-0 w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--score-low)' }} />
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* New presenter */}
                <div className="shrink-0 p-4" style={{ borderTop: '1px solid var(--border)' }}>
                  <button
                    onClick={() => { setShowPresenterPanel(false); setShowNewPresenter(true); setNewPresenterName('') }}
                    disabled={isRecording}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
                    style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)', background: 'transparent' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    New Presenter
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Session transition flash */}
        <AnimatePresence>
          {showTransition && activeSession && (
            <motion.div
              key="transition"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="absolute left-0 right-0 z-30 flex items-center justify-center py-3 pointer-events-none"
              style={{ top: '88px' }}
            >
              <div className="flex items-center gap-3 px-6 py-3 rounded-2xl"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-hover)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
                <span className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>Now recording</span>
                <span className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{activeSession.name}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ThemeProvider>
  )
}
