'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSpring } from 'framer-motion'
import { createClient } from '@/lib/supabase'
import { Event, Session, Criteria, Score } from '@/lib/types'
import { ThemeProvider, ThemeSelector } from '@/components/ThemeSelector'
import { useAppStore } from '@/lib/store'

function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(0)
  const spring = useSpring(0, { stiffness: 45, damping: 18 })
  useEffect(() => {
    spring.set(value)
    return spring.on('change', (v) => setDisplay(Math.round(v)))
  }, [value, spring])
  return <span className={className}>{display}</span>
}

function getBarStyle(score: number) {
  if (score >= 80) return { color: 'var(--score-high)', glow: 'var(--glow-high)' }
  if (score >= 60) return { color: 'var(--score-mid)', glow: 'var(--glow-mid)' }
  if (score >= 40) return { color: 'var(--accent)', glow: 'var(--glow-accent)' }
  return { color: 'var(--score-low)', glow: 'var(--glow-low)' }
}

export default function DisplayClient() {
  const supabase = createClient()
  const [event, setEvent] = useState<Event | null>(null)
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const [criteria, setCriteria] = useState<Criteria[]>([])
  const [scores, setScores] = useState<Record<string, Score>>({})
  const [latestTranscript, setLatestTranscript] = useState('')
  const [clock, setClock] = useState(new Date())
  // Ref rather than state because it's read inside the Supabase Realtime callback,
  // which is a closure that would always see the stale initial value if it used state.
  const activeSessionIdRef = useRef<string | null>(null)
  const [judgeRecording, setJudgeRecording] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Initialise display for a given event (called on load and when event goes live mid-display)
  const initEvent = useCallback(async (sess: Event) => {
    setEvent(sess)

    const { data: crit } = await supabase.from('criteria').select('*').eq('session_id', sess.id).order('order_index')
    if (crit) setCriteria(crit)

    if (sess.active_team_id) {
      activeSessionIdRef.current = sess.active_team_id
      const { data: team } = await supabase.from('teams').select('*').eq('id', sess.active_team_id).single()
      if (team) setActiveSession(team)

      const { data: existingScores } = await supabase.from('scores').select('*')
        .eq('session_id', sess.id).eq('team_id', sess.active_team_id)
      if (existingScores) {
        const map: Record<string, Score> = {}
        existingScores.forEach((s) => { map[s.criteria_id] = s })
        setScores(map)
      }
    }

    // Score updates for this event
    supabase.channel('display-scores')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores', filter: `session_id=eq.${sess.id}` },
        (payload: any) => { if (payload.new) setScores((prev) => ({ ...prev, [payload.new.criteria_id]: payload.new })) })
      .subscribe()

    // Transcript chunks for live ticker
    supabase.channel('display-transcript')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transcript_chunks', filter: `session_id=eq.${sess.id}` },
        (payload: any) => { if (payload.new?.content) setLatestTranscript(payload.new.content) })
      .subscribe()

    // Observe judge/collector presence to show recording state (display page does not track itself)
    const presenceChannel = supabase.channel(`presence:${sess.id}`)
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState<any>()
        const recording = Object.values(state).flat().some((p: any) => p.role === 'judge' && p.isRecording)
        setJudgeRecording(recording)
      })
      .subscribe()
  }, [])

  useEffect(() => {
    // Always subscribe to ALL event updates so we detect:
    //  - an event becoming active after the display page loads
    //  - active_team_id changing (presenter switch)
    //  - theme changes
    const eventChannel = supabase.channel('display-session')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions' },
        async (payload: any) => {
          const updated = payload.new as Event
          // If an event just became active and we have no event yet, initialise
          if (updated.is_active) {
            setEvent(prev => {
              if (!prev || prev.id !== updated.id) {
                // New active event — do a full init
                initEvent(updated)
                return prev // initEvent will call setEvent again
              }
              return updated
            })
            // Handle presenter switch
            if (updated.active_team_id !== activeSessionIdRef.current) {
              activeSessionIdRef.current = updated.active_team_id ?? null
              setScores({})
              setLatestTranscript('')
              if (updated.active_team_id) {
                const { data: t } = await supabase.from('teams').select('*').eq('id', updated.active_team_id).single()
                if (t) setActiveSession(t)
              } else {
                setActiveSession(null)
              }
            }
          }
        })
      .subscribe()

    // Initial load
    async function load() {
      const { data: sess } = await supabase.from('sessions').select('*').eq('is_active', true).maybeSingle()
      if (sess) await initEvent(sess)
    }
    load()

    return () => { supabase.removeChannel(eventChannel) }
  }, [initEvent])

  const overall = (() => {
    const scored = criteria.filter((c) => (scores[c.id]?.score ?? 0) > 0)
    if (!scored.length) return 0
    const w = scored.reduce((s, c) => s + c.weight, 0)
    return Math.round(scored.reduce((s, c) => s + scores[c.id].score * c.weight, 0) / w)
  })()

  const circumference = 2 * Math.PI * 46
  const overallStyle = getBarStyle(overall)

  return (
  <ThemeProvider>
    <div className="fixed inset-0 flex flex-col overflow-hidden" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>

      {/* Ambient */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <motion.div className="absolute top-0 left-1/3 w-[800px] h-[800px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 65%)' }}
          animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 10, repeat: Infinity }} />
        <motion.div className="absolute bottom-0 right-1/3 w-[600px] h-[600px] rounded-full opacity-8"
          style={{ background: 'radial-gradient(circle, var(--accent-secondary) 0%, transparent 65%)' }}
          animate={{ scale: [1.08, 1, 1.08] }} transition={{ duration: 10, repeat: Infinity }} />
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-12 py-5 shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3">
          <img src="/app-icon.svg" alt="Audio Judge" className="w-8 h-8" />
          <span className="text-base font-bold" style={{ color: 'var(--text-muted)' }}>{event?.name || 'Audio Judge'}</span>
        </div>
        <div className="flex items-center gap-5">
          <ThemeSelector />
          <span className="text-base tabular-nums" style={{ color: 'var(--text-muted)' }}>
            {clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <AnimatePresence mode="wait">
            {judgeRecording ? (
              <motion.div key="rec" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute h-full w-full rounded-full opacity-75"
                    style={{ background: 'var(--score-low)' }} />
                  <span className="relative h-2 w-2 rounded-full" style={{ background: 'var(--score-low)' }} />
                </span>
                <span className="text-base font-bold tracking-widest" style={{ color: 'var(--score-low)' }}>RECORDING</span>
              </motion.div>
            ) : (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: 'var(--text-muted)' }} />
                <span className="text-base font-bold tracking-widest" style={{ color: 'var(--text-muted)' }}>STANDBY</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {!activeSession ? (
        <div className="relative z-0 flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="text-7xl">🎯</div>
            <p className="text-2xl font-light" style={{ color: 'var(--text-muted)' }}>Waiting for presentation...</p>
          </div>
        </div>
      ) : (
        <div className="relative z-0 flex-1 flex flex-col min-h-0 pb-16 px-12 pt-6">

          {/* Team name */}
          <AnimatePresence mode="wait">
            <motion.div key={activeSession.id} initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }} className="mb-8 shrink-0">
              <p className="text-base font-bold tracking-[0.35em] uppercase mb-2" style={{ color: 'var(--text-muted)' }}>
                Now Presenting
              </p>
              <h1 className="text-6xl font-black tracking-tight gradient-text">{activeSession.name}</h1>
              {activeSession.description && (
                <p className="text-lg mt-2" style={{ color: 'var(--text-muted)' }}>{activeSession.description}</p>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Scores layout */}
          <div className="flex-1 flex gap-16 min-h-0">

            {/* Criteria bars */}
            <div className="flex-1 flex flex-col justify-center space-y-6 overflow-y-auto pr-4">
              {criteria.map((c, i) => {
                const score = scores[c.id]?.score ?? 0
                const s = getBarStyle(score)
                return (
                  <motion.div key={c.id} initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold tracking-widest uppercase" style={{ color: 'var(--text-secondary)' }}>
                        {c.name}
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black tabular-nums" style={{ color: score > 0 ? s.color : 'var(--text-muted)' }}>
                          {score > 0 ? <AnimatedNumber value={score} /> : '—'}
                        </span>
                        {score > 0 && <span className="text-base" style={{ color: 'var(--text-muted)' }}>/100</span>}
                      </div>
                    </div>

                    <div className="relative h-5 rounded-full overflow-hidden" style={{ background: 'var(--bar-track)' }}>
                      {[20, 40, 60, 80].map((p) => (
                        <div key={p} className="absolute inset-y-0 w-px" style={{ left: `${p}%`, background: 'var(--bar-track)' }} />
                      ))}
                      <motion.div
                        className="absolute inset-y-0 left-0 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: score > 0 ? `${score}%` : '0%' }}
                        transition={{ type: 'spring', stiffness: 40, damping: 14 }}
                        style={{
                          background: score > 0
                            ? `linear-gradient(90deg, color-mix(in srgb, ${s.color} 60%, transparent), ${s.color})`
                            : 'transparent',
                          boxShadow: score > 0 ? `0 0 24px ${s.glow}` : 'none',
                        }}
                      />
                    </div>

                    {scores[c.id]?.reasoning && (
                      <p className="text-base" style={{ color: 'var(--text-muted)' }}>{scores[c.id].reasoning}</p>
                    )}
                  </motion.div>
                )
              })}
            </div>

            {/* Overall circular gauge */}
            <div className="w-64 shrink-0 flex flex-col items-center justify-center">
              <p className="text-base font-bold tracking-[0.35em] uppercase mb-6" style={{ color: 'var(--text-muted)' }}>
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
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transcript ticker */}
      {latestTranscript && (
        <div className="absolute bottom-0 inset-x-0 px-12 py-3" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-glass)', backdropFilter: 'blur(8px)' }}>
          <div className="flex items-center gap-4 overflow-hidden">
            <span className="text-base font-bold tracking-widest uppercase shrink-0" style={{ color: 'var(--text-muted)' }}>
              Transcript
            </span>
            <AnimatePresence mode="wait">
              <motion.p key={latestTranscript.slice(-60)}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="text-base truncate font-mono" style={{ color: 'var(--text-secondary)' }}>
                {latestTranscript}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  </ThemeProvider>
  )
}

