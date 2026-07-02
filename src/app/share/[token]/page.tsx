'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ThemeProvider } from '@/components/ThemeSelector'
import BrandName from '@/components/BrandName'

function getScoreStyle(score: number) {
  if (score >= 70) return { color: 'var(--score-high)' }
  if (score >= 40) return { color: 'var(--score-mid)' }
  return { color: 'var(--score-low)' }
}

function TranscriptToggle({ token, teamId }: { token: string; teamId: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'loaded'>('idle')
  const [transcript, setTranscript] = useState('')
  const [visible, setVisible] = useState(false)

  const load = async () => {
    setState('loading')
    const res = await fetch(`/api/share/${token}/transcript/${teamId}`)
    const data = await res.json()
    setTranscript(data.transcript ?? '')
    setState('loaded')
    setVisible(true)
  }

  if (state === 'loading') {
    return <div className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin mt-1" style={{ color: 'var(--accent)' }} />
  }
  if (state === 'idle') {
    return (
      <button onClick={load} className="text-xs font-medium underline underline-offset-2 mt-1" style={{ color: 'var(--accent)' }}>
        Show transcript
      </button>
    )
  }
  if (!transcript) {
    return <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>No transcript recorded.</p>
  }
  return (
    <div>
      <button onClick={() => setVisible(v => !v)} className="text-xs font-medium underline underline-offset-2 mt-1" style={{ color: 'var(--accent)' }}>
        {visible ? 'Hide transcript' : 'Show transcript'}
      </button>
      {visible && (
        <p className="text-sm leading-relaxed mt-2 whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{transcript}</p>
      )}
    </div>
  )
}

function TeamCard({ team, criteria, scores, rank, index, token }: {
  team: any; criteria: any[]; scores: any[]; rank: number; index: number; token: string
}) {
  const [expanded, setExpanded] = useState(false)

  const teamScores = scores.filter(s => s.team_id === team.id)
  const scoredCriteria = criteria.filter(c => (teamScores.find(s => s.criteria_id === c.id)?.score ?? 0) > 0)
  const overall = scoredCriteria.length > 0
    ? (() => {
        const w = scoredCriteria.reduce((s, c) => s + c.weight, 0)
        return Math.round(scoredCriteria.reduce((s, c) => s + (teamScores.find(sc => sc.criteria_id === c.id)?.score ?? 0) * c.weight, 0) / w)
      })()
    : 0
  const overallStyle = getScoreStyle(overall)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid var(--border)', background: 'var(--bg-card)' }}>

      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left transition-all"
        style={{ background: expanded ? 'var(--bg-card-hover)' : 'transparent' }}>

        <span className="text-xl font-black tabular-nums w-7 shrink-0 text-center" style={{ color: 'var(--text-muted)' }}>
          {rank}
        </span>

        <div className="flex-1 min-w-0">
          <span className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{team.name}</span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {scoredCriteria.length > 0 ? (
            <div className="flex items-center gap-2">
              {scoredCriteria.slice(0, 3).map(c => {
                const score = teamScores.find(s => s.criteria_id === c.id)?.score ?? 0
                return (
                  <div key={c.id} className="text-center">
                    <div className="text-sm font-bold tabular-nums" style={getScoreStyle(score)}>{score}</div>
                    <div className="text-xs truncate max-w-[56px]" style={{ color: 'var(--text-muted)' }}>{c.name}</div>
                  </div>
                )
              })}
              {scoredCriteria.length > 3 && (
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>+{scoredCriteria.length - 3}</span>
              )}
              <div className="w-px h-6 mx-1" style={{ background: 'var(--border)' }} />
              <div className="text-center">
                <div className="text-base font-black tabular-nums" style={overallStyle}>{overall}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Overall</div>
              </div>
            </div>
          ) : (
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>No scores</span>
          )}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ color: 'var(--text-muted)', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden">
            <div className="px-5 pb-5 space-y-4" style={{ borderTop: '1px solid var(--border)' }}>
              {team.summary && (
                <div className="pt-4">
                  <p className="text-xs font-semibold tracking-widest uppercase mb-1.5" style={{ color: 'var(--text-muted)' }}>Summary</p>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{team.summary}</p>
                </div>
              )}
              <div className={team.summary ? '' : 'pt-4'}>
                <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: 'var(--text-muted)' }}>Transcript</p>
                <TranscriptToggle token={token} teamId={team.id} />
              </div>
              {criteria.length > 0 && (
                <div className="space-y-4 pt-2">
                  <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>Scores</p>
                  {criteria.map(c => {
                    const entry = teamScores.find(s => s.criteria_id === c.id)
                    const score = entry?.score ?? 0
                    const style = getScoreStyle(score)
                    return (
                      <div key={c.id}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{c.name}</span>
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
                        {entry?.reasoning && (
                          <p className="text-sm mt-1.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{entry.reasoning}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function SharePage() {
  const params = useParams()
  const token = params.token as string

  const [data, setData] = useState<any>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/share/${token}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [token])

  const rankedTeams = data ? [...(data.teams ?? [])].map((team: any) => {
    const teamScores = (data.scores ?? []).filter((s: any) => s.team_id === team.id)
    const scoredCriteria = (data.criteria ?? []).filter((c: any) => (teamScores.find((s: any) => s.criteria_id === c.id)?.score ?? 0) > 0)
    const overall = scoredCriteria.length > 0
      ? (() => {
          const w = scoredCriteria.reduce((s: number, c: any) => s + c.weight, 0)
          return Math.round(scoredCriteria.reduce((s: number, c: any) => s + (teamScores.find((sc: any) => sc.criteria_id === c.id)?.score ?? 0) * c.weight, 0) / w)
        })()
      : 0
    return { ...team, overall }
  }).sort((a: any, b: any) => b.overall - a.overall) : []

  return (
    <ThemeProvider>
      <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>

        <header className="sticky top-0 z-30 flex items-center justify-between px-6 h-14 shrink-0"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-glass)', backdropFilter: 'blur(12px)' }}>
          <div className="flex items-center gap-3">
            <BrandName />
            {data?.session && (
              <>
                <span style={{ color: 'var(--border-hover)' }}>·</span>
                <span className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>{data.session.name}</span>
              </>
            )}
          </div>
          <span className="text-xs font-semibold tracking-widest uppercase px-2 py-1 rounded"
            style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--border-hover)' }}>
            Results
          </span>
        </header>

        <main className="max-w-2xl mx-auto px-6 py-10">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-5 h-5 rounded-full border-2 animate-spin"
                style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
            </div>
          ) : error ? (
            <div className="text-center py-24 space-y-2">
              <p className="text-lg font-semibold" style={{ color: 'var(--text-secondary)' }}>Results not found</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>This link may have expired or been removed.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {data.session.brief && (
                <div className="mb-6 px-5 py-4 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <p className="text-xs font-semibold tracking-widest uppercase mb-1.5" style={{ color: 'var(--text-muted)' }}>Brief</p>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{data.session.brief}</p>
                </div>
              )}
              {rankedTeams.length === 0 ? (
                <p className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>No results yet.</p>
              ) : (
                rankedTeams.map((team: any, i: number) => (
                  <TeamCard
                    key={team.id}
                    team={team}
                    criteria={data.criteria}
                    scores={data.scores}
                    rank={i + 1}
                    index={i}
                    token={token}
                  />
                ))
              )}
            </div>
          )}
        </main>
      </div>
    </ThemeProvider>
  )
}
