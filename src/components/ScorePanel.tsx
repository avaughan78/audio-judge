'use client'

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { ScoreBar } from './ScoreBar'

interface ScorePanelProps {
  fullscreen?: boolean
}

function ScoreOverrideInput({ criteriaId, current, onClose }: { criteriaId: string; current: number; onClose: () => void }) {
  const [value, setValue] = useState(String(current || ''))
  const [saving, setSaving] = useState(false)
  const { session, activeTeam, updateScore } = useAppStore.getState()

  const save = async () => {
    const num = parseInt(value, 10)
    if (isNaN(num) || num < 0 || num > 100) return
    if (!session || !activeTeam) return
    setSaving(true)
    const res = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: session.id, teamId: activeTeam.id, criteriaId, score: num, reasoning: 'Manual override' }),
    })
    if (res.ok) {
      updateScore({ criteria_id: criteriaId, score: num, reasoning: 'Manual override', team_id: activeTeam.id, session_id: session.id, id: '', updated_at: '' })
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
        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border-hover)', color: 'var(--text-primary)' }}
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

export function ScorePanel({ fullscreen = false }: ScorePanelProps) {
  const criteria = useAppStore((s) => s.criteria)
  const scores = useAppStore((s) => s.scores)
  const activeTeam = useAppStore((s) => s.activeTeam)
  const isSummarising = useAppStore((s) => s.isSummarising)
  const isRecording = useAppStore((s) => s.isRecording)
  const [editingCriteriaId, setEditingCriteriaId] = useState<string | null>(null)

  const overall = useMemo(() => {
    const scored = criteria.filter((c) => (scores[c.id]?.score ?? 0) > 0)
    if (!scored.length) return 0
    const totalWeight = scored.reduce((sum, c) => sum + c.weight, 0)
    const weightedSum = scored.reduce((sum, c) => sum + scores[c.id].score * c.weight, 0)
    return Math.round(weightedSum / totalWeight)
  }, [criteria, scores])

  const overallColor = overall >= 80 ? 'var(--score-high)'
    : overall >= 60 ? 'var(--score-mid)'
    : overall >= 40 ? 'var(--accent)'
    : overall > 0 ? 'var(--score-low)'
    : 'var(--text-muted)'

  const circumference = 2 * Math.PI * 40

  if (fullscreen) {
    return (
      <div className="flex flex-col h-full">
        {!activeTeam ? (
          <div className="flex-1 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Select a participant above to begin
          </div>
        ) : criteria.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
            No criteria — configure in Admin
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-8">
              {criteria.map((c, i) => (
                <div key={c.id}>
                  <ScoreBar
                    name={c.name}
                    description={c.description}
                    score={scores[c.id]?.score ?? 0}
                    reasoning={scores[c.id]?.reasoning}
                    weight={c.weight}
                    index={i}
                    xl
                    isScanning={isRecording && isSummarising}
                    onScoreClick={() => setEditingCriteriaId(editingCriteriaId === c.id ? null : c.id)}
                  />
                  <AnimatePresence>
                    {editingCriteriaId === c.id && (
                      <ScoreOverrideInput
                        criteriaId={c.id}
                        current={scores[c.id]?.score ?? 0}
                        onClose={() => setEditingCriteriaId(null)}
                      />
                    )}
                  </AnimatePresence>
                </div>
              ))}

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: criteria.length * 0.07 + 0.2 }}
                className="pt-6 flex items-center gap-6"
                style={{ borderTop: '1px solid var(--border)' }}
              >
                <div className="relative w-24 h-24 shrink-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" fill="none" strokeWidth="7" style={{ stroke: 'var(--ring-track)' }} />
                    <motion.circle
                      cx="50" cy="50" r="40" fill="none" strokeWidth="7" strokeLinecap="round"
                      strokeDasharray={circumference}
                      initial={{ strokeDashoffset: circumference }}
                      animate={{ strokeDashoffset: circumference * (1 - overall / 100) }}
                      transition={{ type: 'spring', stiffness: 40, damping: 15 }}
                      style={{ stroke: overallColor, filter: overall > 0 ? `drop-shadow(0 0 8px ${overallColor})` : 'none' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <motion.span
                      className="text-3xl font-black tabular-nums leading-none"
                      style={{ color: overallColor }}
                      key={overall}
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200 }}
                    >
                      {overall || '—'}
                    </motion.span>
                    {overall > 0 && (
                      <span className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>/100</span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--text-muted)' }}>Overall Score</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Weighted average · click a score to override</p>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>
          Scoring Criteria
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-5 min-h-0">
        {!activeTeam ? (
          <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--text-muted)' }}>
            Select a participant to begin
          </div>
        ) : criteria.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--text-muted)' }}>
            No criteria — configure in Admin
          </div>
        ) : (
          <>
            {criteria.map((c, i) => (
              <div key={c.id}>
                <ScoreBar
                  name={c.name}
                  description={c.description}
                  score={scores[c.id]?.score ?? 0}
                  reasoning={scores[c.id]?.reasoning}
                  weight={c.weight}
                  index={i}
                  isScanning={isRecording && isSummarising}
                  onScoreClick={() => setEditingCriteriaId(editingCriteriaId === c.id ? null : c.id)}
                />
                <AnimatePresence>
                  {editingCriteriaId === c.id && (
                    <ScoreOverrideInput
                      criteriaId={c.id}
                      current={scores[c.id]?.score ?? 0}
                      onClose={() => setEditingCriteriaId(null)}
                    />
                  )}
                </AnimatePresence>
              </div>
            ))}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: criteria.length * 0.07 + 0.2 }}
              className="pt-4"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--text-muted)' }}>Overall Score</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Weighted average</p>
                </div>
                <div className="relative w-20 h-20">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" fill="none" strokeWidth="7" style={{ stroke: 'var(--ring-track)' }} />
                    <motion.circle
                      cx="50" cy="50" r="40" fill="none" strokeWidth="7" strokeLinecap="round"
                      strokeDasharray={circumference}
                      initial={{ strokeDashoffset: circumference }}
                      animate={{ strokeDashoffset: circumference * (1 - overall / 100) }}
                      transition={{ type: 'spring', stiffness: 40, damping: 15 }}
                      style={{ stroke: overallColor, filter: overall > 0 ? `drop-shadow(0 0 6px ${overallColor})` : 'none' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <motion.span className="text-2xl font-black tabular-nums leading-none" style={{ color: overallColor }}
                      key={overall} initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
                      {overall || '—'}
                    </motion.span>
                    {overall > 0 && <span className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>/100</span>}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </div>
    </div>
  )
}
