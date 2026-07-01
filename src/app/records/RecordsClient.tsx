'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase'
import { ThemeProvider } from '@/components/ThemeSelector'
import AppHeader from '@/components/AppHeader'
import type { Event, Session, Criteria, Score } from '@/lib/types'

interface EventRecord {
  event: Event
  sessions: (Session & { scores: Score[] })[]
  criteria: Criteria[]
}

function getScoreStyle(score: number) {
  if (score >= 80) return { color: 'var(--score-high)' }
  if (score >= 60) return { color: 'var(--score-mid)' }
  if (score >= 40) return { color: 'var(--accent)' }
  return { color: 'var(--score-low)' }
}

function OverallScore({ sessions, criteria }: { sessions: (Session & { scores: Score[] })[]; criteria: Criteria[] }) {
  const allScores = sessions.flatMap(t => t.scores)
  if (!allScores.length) return null

  const scored = criteria.filter(c => allScores.some(s => s.criteria_id === c.id && s.score > 0))
  if (!scored.length) return null

  // Average across sessions, weighted
  const sessionAverages = sessions.map(session => {
    const sessionScored = scored.filter(c => (session.scores.find(s => s.criteria_id === c.id)?.score ?? 0) > 0)
    if (!sessionScored.length) return null
    const w = sessionScored.reduce((s, c) => s + c.weight, 0)
    return sessionScored.reduce((s, c) => s + (session.scores.find(sc => sc.criteria_id === c.id)?.score ?? 0) * c.weight, 0) / w
  }).filter(Boolean) as number[]

  if (!sessionAverages.length) return null
  const avg = Math.round(sessionAverages.reduce((a, b) => a + b, 0) / sessionAverages.length)
  const style = getScoreStyle(avg)

  return (
    <span className="text-base font-bold tabular-nums" style={style}>{avg}/100</span>
  )
}

function SessionCard({ session, criteria, index, onDelete }: { session: Session & { scores: Score[] }; criteria: Criteria[]; index: number; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const scoredCriteria = criteria.filter(c => (session.scores.find(s => s.criteria_id === c.id)?.score ?? 0) > 0)

  const weighted = scoredCriteria.length > 0
    ? (() => {
        const w = scoredCriteria.reduce((s, c) => s + c.weight, 0)
        return Math.round(scoredCriteria.reduce((s, c) => s + (session.scores.find(sc => sc.criteria_id === c.id)?.score ?? 0) * c.weight, 0) / w)
      })()
    : 0

  const overallStyle = getScoreStyle(weighted)
  const createdAt = session.created_at ? new Date(session.created_at) : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid var(--border)', background: 'var(--bg-card)' }}>

      {/* Session header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left transition-all"
        style={{ background: expanded ? 'var(--bg-card-hover)' : 'transparent' }}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{session.name}</span>
            {createdAt && (
              <span className="text-base" style={{ color: 'var(--text-muted)' }}>
                {createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          {session.summary && !expanded && (
            <p className="text-base mt-1 truncate" style={{ color: 'var(--text-muted)' }}>{session.summary}</p>
          )}
        </div>

        {/* Score chips */}
        <div className="flex items-center gap-3 shrink-0">
          {scoredCriteria.length > 0 ? (
            <div className="flex items-center gap-2">
              {scoredCriteria.slice(0, 3).map(c => {
                const score = session.scores.find(s => s.criteria_id === c.id)?.score ?? 0
                return (
                  <div key={c.id} className="text-center">
                    <div className="text-base font-bold tabular-nums" style={getScoreStyle(score)}>{score}</div>
                    <div className="text-base truncate max-w-[48px]" style={{ color: 'var(--text-muted)' }}>{c.name}</div>
                  </div>
                )
              })}
              {scoredCriteria.length > 3 && (
                <span className="text-base" style={{ color: 'var(--text-muted)' }}>+{scoredCriteria.length - 3}</span>
              )}
              <div className="w-px h-6 mx-1" style={{ background: 'var(--border)' }} />
              <div className="text-center">
                <div className="text-base font-black tabular-nums" style={overallStyle}>{weighted}</div>
                <div className="text-base" style={{ color: 'var(--text-muted)' }}>Overall</div>
              </div>
            </div>
          ) : (
            <span className="text-base" style={{ color: 'var(--text-muted)' }}>No scores</span>
          )}
          <button
            onClick={e => { e.stopPropagation(); setConfirmDelete(v => !v) }}
            className="p-1.5 rounded-lg transition-all"
            style={{ color: 'var(--score-low)', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.14)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.06)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
            </svg>
          </button>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ color: 'var(--text-muted)', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </button>

      {/* Delete confirm */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-2.5 text-sm"
              style={{ background: 'rgba(239,68,68,0.06)', borderTop: '1px solid rgba(239,68,68,0.15)', color: '#f87171' }}>
              <span className="flex-1">Delete <strong>{session.name}</strong> and all its scores?</span>
              <button onClick={async () => {
                const res = await fetch(`/api/teams/${session.id}`, { method: 'DELETE' })
                if (res.ok) onDelete(session.id)
                else console.error('Delete failed:', await res.text())
              }} className="px-3 py-1 rounded-lg font-medium"
                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
                Delete
              </button>
              <button onClick={() => setConfirmDelete(false)} style={{ color: 'var(--text-muted)' }}>Cancel</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden">
            <div className="px-5 pb-5 space-y-4" style={{ borderTop: '1px solid var(--border)' }}>

              {/* Summary */}
              {session.summary && (
                <div className="pt-4">
                  <p className="text-base font-bold tracking-widest uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Summary</p>
                  <p className="text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{session.summary}</p>
                </div>
              )}

              {/* Criteria scores */}
              {criteria.length > 0 && (
                <div>
                  <p className="text-base font-bold tracking-widest uppercase mb-3 pt-2" style={{ color: 'var(--text-muted)' }}>Scores</p>
                  <div className="space-y-3">
                    {criteria.map(c => {
                      const scoreEntry = session.scores.find(s => s.criteria_id === c.id)
                      const score = scoreEntry?.score ?? 0
                      const style = getScoreStyle(score)
                      return (
                        <div key={c.id}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-base font-medium" style={{ color: 'var(--text-secondary)' }}>{c.name}</span>
                            <span className="text-base font-bold tabular-nums" style={score > 0 ? style : { color: 'var(--text-muted)' }}>
                              {score > 0 ? `${score}/100` : '—'}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bar-track)' }}>
                            <motion.div
                              className="h-full rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: score > 0 ? `${score}%` : '0%' }}
                              transition={{ type: 'spring', stiffness: 40, damping: 14, delay: 0.1 }}
                              style={{ background: score > 0 ? style.color : 'transparent' }}
                            />
                          </div>
                          {scoreEntry?.reasoning && (
                            <p className="text-base mt-1" style={{ color: 'var(--text-muted)' }}>{scoreEntry.reasoning}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function RecordsClient() {
  const [records, setRecords] = useState<EventRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set())
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState<string | null>(null)

  const deleteEvent = async (id: string) => {
    const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      console.error('Delete failed:', await res.text())
      return
    }
    setRecords(prev => prev.filter(r => r.event.id !== id))
    setConfirmDeleteEvent(null)
  }

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const { data: events } = await supabase
        .from('sessions')
        .select('*')
        .order('created_at', { ascending: false })

      if (!events?.length) { setLoading(false); return }

      const eventIds = events.map(s => s.id)

      const [{ data: allTeams }, { data: allCriteria }, { data: allScores }] = await Promise.all([
        supabase.from('teams').select('*').in('session_id', eventIds).order('order_index'),
        supabase.from('criteria').select('*').in('session_id', eventIds).order('order_index'),
        supabase.from('scores').select('*').in('session_id', eventIds),
      ])

      const built: EventRecord[] = events.map(event => {
        const criteria = (allCriteria ?? []).filter(c => c.session_id === event.id)
        const sessions = (allTeams ?? [])
          .filter(t => t.session_id === event.id)
          .map(session => ({
            ...session,
            scores: (allScores ?? []).filter(s => s.team_id === session.id),
          }))
        return { event, sessions, criteria }
      })

      setRecords(built)
      // Auto-expand the most recent event that has data
      const firstWithData = built.find(r => r.sessions.length > 0)
      if (firstWithData) setExpandedEvents(new Set([firstWithData.event.id]))
      setLoading(false)
    }
    load()
  }, [])

  const deleteSession = (eventId: string, sessionId: string) => {
    setRecords(prev => prev.map(r =>
      r.event.id === eventId
        ? { ...r, sessions: r.sessions.filter(s => s.id !== sessionId) }
        : r
    ))
  }

  const toggleEvent = (id: string) => {
    setExpandedEvents(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  return (
    <ThemeProvider>
      <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>

        <AppHeader back section="Records" items={[{ label: 'Admin', href: '/admin', icon: 'settings' }]} />

        <main className="max-w-3xl mx-auto px-6 py-10">

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-5 h-5 rounded-full border-2 animate-spin"
                style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-24 space-y-4">
              <div className="text-5xl">📂</div>
              <p className="text-lg font-semibold" style={{ color: 'var(--text-secondary)' }}>No records yet</p>
              <p className="text-base" style={{ color: 'var(--text-muted)' }}>
                Records appear here once you start recording.
              </p>
              <Link href="/" className="inline-block mt-2 text-base underline underline-offset-4"
                style={{ color: 'var(--accent)' }}>
                Go to Judge →
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {records.map((record) => {
                const isExpanded = expandedEvents.has(record.event.id)
                const { event, sessions, criteria } = record
                const hasData = sessions.length > 0

                return (
                  <div key={event.id} className="rounded-2xl overflow-hidden"
                    style={{ border: '1px solid var(--border)' }}>

                    {/* Event header */}
                    <div
                      onClick={() => toggleEvent(event.id)}
                      className="w-full flex items-center gap-4 px-6 py-5 text-left transition-all cursor-pointer"
                      style={{ background: isExpanded ? 'var(--bg-card)' : 'rgba(255,255,255,0.01)' }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          {event.is_active && (
                            <span className="h-2 w-2 rounded-full animate-pulse shrink-0" style={{ background: '#4ade80' }} />
                          )}
                          <h2 className="text-base font-bold truncate" style={{ color: 'var(--text-primary)' }}>{event.name}</h2>
                          {event.is_active && (
                            <span className="text-base font-bold shrink-0" style={{ color: '#4ade80' }}>LIVE</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-base" style={{ color: 'var(--text-muted)' }}>
                            {new Date(event.created_at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          {hasData && (
                            <span className="text-base px-1.5 py-0.5 rounded font-medium"
                              style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--border-hover)' }}>
                              {sessions.length} participant{sessions.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {hasData && <OverallScore sessions={sessions} criteria={criteria} />}
                        <button
                          onClick={e => { e.stopPropagation(); setConfirmDeleteEvent(confirmDeleteEvent === event.id ? null : event.id) }}
                          className="flex items-center gap-1.5 text-base px-2.5 py-1 rounded-lg transition-all"
                          style={{ color: 'var(--score-low)', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.12)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.06)' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                          </svg>
                          Delete
                        </button>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                          style={{ color: 'var(--text-muted)', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </div>
                    </div>

                    {/* Delete confirm */}
                    <AnimatePresence>
                      {confirmDeleteEvent === event.id && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden">
                          <div className="flex items-center gap-3 px-6 py-3 text-sm"
                            style={{ background: 'rgba(239,68,68,0.06)', borderTop: '1px solid rgba(239,68,68,0.15)', color: '#f87171' }}>
                            <span className="flex-1">Delete <strong>{event.name}</strong> and all its data?</span>
                            <button onClick={() => deleteEvent(event.id)}
                              className="px-3 py-1 rounded-lg font-medium"
                              style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
                              Delete
                            </button>
                            <button onClick={() => setConfirmDeleteEvent(null)} style={{ color: 'var(--text-muted)' }}>Cancel</button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Event segments */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden">
                          <div className="px-4 pb-4 pt-2 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
                            {!hasData ? (
                              <p className="text-base py-4 text-center" style={{ color: 'var(--text-muted)' }}>
                                No recordings yet — press Record on the Judge page to begin.
                              </p>
                            ) : (
                              <>
                                {event.brief && (
                                  <div className="px-1 py-3">
                                    <p className="text-base font-bold tracking-widest uppercase mb-1.5" style={{ color: 'var(--text-muted)' }}>Context</p>
                                    <p className="text-base leading-relaxed" style={{ color: 'var(--text-muted)' }}>{event.brief}</p>
                                  </div>
                                )}
                                {sessions.map((session, i) => (
                                  <SessionCard key={session.id} session={session} criteria={criteria} index={i} onDelete={(id) => deleteSession(event.id, id)} />
                                ))}
                              </>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>
          )}
        </main>
      </div>
    </ThemeProvider>
  )
}
