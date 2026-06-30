'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { ScoreBar } from './ScoreBar'

export function ScorePanel() {
  const criteria = useAppStore((s) => s.criteria)
  const scores = useAppStore((s) => s.scores)
  const activeTeam = useAppStore((s) => s.activeTeam)
  const isSummarising = useAppStore((s) => s.isSummarising)
  const isRecording = useAppStore((s) => s.isRecording)

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

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>
          Judging Criteria
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 min-h-0">
        {!activeTeam ? (
          <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--text-muted)' }}>
            Select a team to begin judging
          </div>
        ) : criteria.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--text-muted)' }}>
            No criteria — configure in Admin
          </div>
        ) : (
          <>
            {criteria.map((c, i) => (
              <ScoreBar
                key={c.id}
                name={c.name}
                description={c.description}
                score={scores[c.id]?.score ?? 0}
                reasoning={scores[c.id]?.reasoning}
                weight={c.weight}
                index={i}
                isScanning={isRecording && isSummarising}
              />
            ))}

            {/* Overall score */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: criteria.length * 0.07 + 0.2 }}
              className="pt-4"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--text-muted)' }}>
                    Overall Score
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Weighted average</p>
                </div>

                {/* Circular gauge */}
                <div className="relative w-20 h-20">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" fill="none" strokeWidth="7" style={{ stroke: 'rgba(255,255,255,0.05)' }} />
                    <motion.circle
                      cx="50" cy="50" r="40"
                      fill="none"
                      strokeWidth="7"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      initial={{ strokeDashoffset: circumference }}
                      animate={{ strokeDashoffset: circumference * (1 - overall / 100) }}
                      transition={{ type: 'spring', stiffness: 40, damping: 15 }}
                      style={{ stroke: overallColor, filter: overall > 0 ? `drop-shadow(0 0 6px ${overallColor})` : 'none' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <motion.span
                      className="text-2xl font-black tabular-nums leading-none"
                      style={{ color: overallColor }}
                      key={overall}
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200 }}
                    >
                      {overall || '—'}
                    </motion.span>
                    {overall > 0 && (
                      <span className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>/100</span>
                    )}
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
