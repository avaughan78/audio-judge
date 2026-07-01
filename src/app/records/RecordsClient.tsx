'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase'
import { ThemeProvider, ThemeSelector } from '@/components/ThemeSelector'
import type { Session, Team, Criteria, Score } from '@/lib/types'

interface SessionRecord {
  session: Session
  teams: (Team & { scores: Score[] })[]
  criteria: Criteria[]
}

function getScoreStyle(score: number) {
  if (score >= 80) return { color: 'var(--score-high)' }
  if (score >= 60) return { color: 'var(--score-mid)' }
  if (score >= 40) return { color: 'var(--accent)' }
  return { color: 'var(--score-low)' }
}

function OverallScore({ teams, criteria }: { teams: (Team & { scores: Score[] })[]; criteria: Criteria[] }) {
  const allScores = teams.flatMap(t => t.scores)
  if (!allScores.length) return null

  const scored = criteria.filter(c => allScores.some(s => s.criteria_id === c.id && s.score > 0))
  if (!scored.length) return null

  // Average across teams, weighted
  const teamAverages = teams.map(team => {
    const teamScored = scored.filter(c => (team.scores.find(s => s.criteria_id === c.id)?.score ?? 0) > 0)
    if (!teamScored.length) return null
    const w = teamScored.reduce((s, c) => s + c.weight, 0)
    return teamScored.reduce((s, c) => s + (team.scores.find(sc => sc.criteria_id === c.id)?.score ?? 0) * c.weight, 0) / w
  }).filter(Boolean) as number[]

  if (!teamAverages.length) return null
  const avg = Math.round(teamAverages.reduce((a, b) => a + b, 0) / teamAverages.length)
  const style = getScoreStyle(avg)

  return (
    <span className="text-sm font-bold tabular-nums" style={style}>{avg}/100</span>
  )
}

function TeamCard({ team, criteria, index }: { team: Team & { scores: Score[] }; criteria: Criteria[]; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const scoredCriteria = criteria.filter(c => (team.scores.find(s => s.criteria_id === c.id)?.score ?? 0) > 0)

  const weighted = scoredCriteria.length > 0
    ? (() => {
        const w = scoredCriteria.reduce((s, c) => s + c.weight, 0)
        return Math.round(scoredCriteria.reduce((s, c) => s + (team.scores.find(sc => sc.criteria_id === c.id)?.score ?? 0) * c.weight, 0) / w)
      })()
    : 0

  const overallStyle = getScoreStyle(weighted)
  const createdAt = team.created_at ? new Date(team.created_at) : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid var(--border)', background: 'var(--bg-card)' }}>

      {/* Team header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left transition-all"
        style={{ background: expanded ? 'var(--bg-card-hover)' : 'transparent' }}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{team.name}</span>
            {createdAt && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          {team.summary && !expanded && (
            <p className="text-xs mt-1 truncate" style={{ color: 'var(--text-muted)' }}>{team.summary}</p>
          )}
        </div>

        {/* Score chips */}
        <div className="flex items-center gap-3 shrink-0">
          {scoredCriteria.length > 0 ? (
            <div className="flex items-center gap-2">
              {scoredCriteria.slice(0, 3).map(c => {
                const score = team.scores.find(s => s.criteria_id === c.id)?.score ?? 0
                return (
                  <div key={c.id} className="text-center">
                    <div className="text-xs font-bold tabular-nums" style={getScoreStyle(score)}>{score}</div>
                    <div className="text-xs truncate max-w-[48px]" style={{ color: 'var(--text-muted)' }}>{c.name}</div>
                  </div>
                )
              })}
              {scoredCriteria.length > 3 && (
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>+{scoredCriteria.length - 3}</span>
              )}
              <div className="w-px h-6 mx-1" style={{ background: 'var(--border)' }} />
              <div className="text-center">
                <div className="text-sm font-black tabular-nums" style={overallStyle}>{weighted}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Overall</div>
              </div>
            </div>
          ) : (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>No scores</span>
          )}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ color: 'var(--text-muted)', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </button>

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
              {team.summary && (
                <div className="pt-4">
                  <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Summary</p>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{team.summary}</p>
                </div>
              )}

              {/* Criteria scores */}
              {criteria.length > 0 && (
                <div>
                  <p className="text-xs font-bold tracking-widest uppercase mb-3 pt-2" style={{ color: 'var(--text-muted)' }}>Scores</p>
                  <div className="space-y-3">
                    {criteria.map(c => {
                      const scoreEntry = team.scores.find(s => s.criteria_id === c.id)
                      const score = scoreEntry?.score ?? 0
                      const style = getScoreStyle(score)
                      return (
                        <div key={c.id}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{c.name}</span>
                            <span className="text-sm font-bold tabular-nums" style={score > 0 ? style : { color: 'var(--text-muted)' }}>
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
                            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{scoreEntry.reasoning}</p>
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
  const [records, setRecords] = useState<SessionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const { data: sessions } = await supabase
        .from('sessions')
        .select('*')
        .order('created_at', { ascending: false })

      if (!sessions?.length) { setLoading(false); return }

      const sessionIds = sessions.map(s => s.id)

      const [{ data: allTeams }, { data: allCriteria }, { data: allScores }] = await Promise.all([
        supabase.from('teams').select('*').in('session_id', sessionIds).order('order_index'),
        supabase.from('criteria').select('*').in('session_id', sessionIds).order('order_index'),
        supabase.from('scores').select('*').in('session_id', sessionIds),
      ])

      const built: SessionRecord[] = sessions.map(session => {
        const criteria = (allCriteria ?? []).filter(c => c.session_id === session.id)
        const teams = (allTeams ?? [])
          .filter(t => t.session_id === session.id)
          .map(team => ({
            ...team,
            scores: (allScores ?? []).filter(s => s.team_id === team.id),
          }))
        return { session, teams, criteria }
      })

      setRecords(built)
      // Auto-expand the most recent session that has data
      const firstWithData = built.find(r => r.teams.length > 0)
      if (firstWithData) setExpandedSessions(new Set([firstWithData.session.id]))
      setLoading(false)
    }
    load()
  }, [])

  const toggleSession = (id: string) => {
    setExpandedSessions(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  return (
    <ThemeProvider>
      <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>

        {/* Header */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-6 h-14"
          style={{ borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)' }}>
          <div className="flex items-center gap-3">
            <Link href="/" className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </Link>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--gradient-from), var(--gradient-to))' }}>
              <span className="text-xs font-black text-white">AJ</span>
            </div>
            <span className="font-bold gradient-text">AudioJudge</span>
            <span style={{ color: 'var(--border-hover)' }}>·</span>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Records</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeSelector />
            <Link href="/admin"
              className="text-sm px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hover)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}>
              Admin
            </Link>
          </div>
        </header>

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
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Records appear here after you use Punctuate during a session.
              </p>
              <Link href="/" className="inline-block mt-2 text-sm underline underline-offset-4"
                style={{ color: 'var(--accent)' }}>
                Go to Judge →
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {records.map((record) => {
                const isExpanded = expandedSessions.has(record.session.id)
                const { session, teams, criteria } = record
                const hasData = teams.length > 0

                return (
                  <div key={session.id} className="rounded-2xl overflow-hidden"
                    style={{ border: '1px solid var(--border)' }}>

                    {/* Session header */}
                    <button
                      onClick={() => toggleSession(session.id)}
                      className="w-full flex items-center gap-4 px-6 py-5 text-left transition-all"
                      style={{ background: isExpanded ? 'var(--bg-card)' : 'rgba(255,255,255,0.01)' }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          {session.is_active && (
                            <span className="h-2 w-2 rounded-full animate-pulse shrink-0" style={{ background: '#4ade80' }} />
                          )}
                          <h2 className="text-base font-bold truncate" style={{ color: 'var(--text-primary)' }}>{session.name}</h2>
                          {session.is_active && (
                            <span className="text-xs font-bold shrink-0" style={{ color: '#4ade80' }}>LIVE</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {new Date(session.created_at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          {hasData && (
                            <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                              style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--border-hover)' }}>
                              {teams.length} session{teams.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        {hasData && <OverallScore teams={teams} criteria={criteria} />}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                          style={{ color: 'var(--text-muted)', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </div>
                    </button>

                    {/* Session segments */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden">
                          <div className="px-4 pb-4 pt-2 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
                            {!hasData ? (
                              <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
                                No sessions recorded yet — use Punctuate on the Judge page to capture segments.
                              </p>
                            ) : (
                              <>
                                {session.brief && (
                                  <div className="px-1 py-3">
                                    <p className="text-xs font-bold tracking-widest uppercase mb-1.5" style={{ color: 'var(--text-muted)' }}>Context</p>
                                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{session.brief}</p>
                                  </div>
                                )}
                                {teams.map((team, i) => (
                                  <TeamCard key={team.id} team={team} criteria={criteria} index={i} />
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
