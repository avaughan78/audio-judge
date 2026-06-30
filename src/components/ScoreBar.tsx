'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useSpring } from 'framer-motion'

function AnimatedNumber({ target }: { target: number }) {
  const [display, setDisplay] = useState(0)
  const spring = useSpring(0, { stiffness: 55, damping: 20 })

  useEffect(() => {
    spring.set(target)
    return spring.on('change', (v) => setDisplay(Math.round(v)))
  }, [target, spring])

  return <>{display}</>
}

function getScoreStyle(score: number): { color: string; glow: string; gradient: string; label: string } {
  if (score >= 80) return {
    color: 'var(--score-high)',
    glow: 'var(--glow-high)',
    gradient: `linear-gradient(90deg, color-mix(in srgb, var(--score-high) 70%, transparent), var(--score-high))`,
    label: 'EXCELLENT',
  }
  if (score >= 60) return {
    color: 'var(--score-mid)',
    glow: 'var(--glow-mid)',
    gradient: `linear-gradient(90deg, color-mix(in srgb, var(--score-mid) 70%, transparent), var(--score-mid))`,
    label: 'GOOD',
  }
  if (score >= 40) return {
    color: 'var(--accent)',
    glow: 'var(--glow-accent)',
    gradient: `linear-gradient(90deg, color-mix(in srgb, var(--accent) 70%, transparent), var(--accent))`,
    label: 'FAIR',
  }
  return {
    color: 'var(--score-low)',
    glow: 'var(--glow-low)',
    gradient: `linear-gradient(90deg, color-mix(in srgb, var(--score-low) 70%, transparent), var(--score-low))`,
    label: 'DEVELOPING',
  }
}

interface ScoreBarProps {
  name: string
  description?: string | null
  score: number
  reasoning?: string | null
  weight?: number
  index?: number
  large?: boolean
  isScanning?: boolean
}

export function ScoreBar({ name, description, score, reasoning, weight = 1, index = 0, large = false, isScanning = false }: ScoreBarProps) {
  const style = getScoreStyle(score)
  const hasScore = score > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.35, ease: 'easeOut' }}
      className="space-y-2"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`font-bold tracking-widest uppercase truncate ${large ? 'text-sm' : 'text-xs'}`}
            style={{ color: 'var(--text-secondary)' }}>
            {name}
          </span>
          {weight !== 1 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md shrink-0"
              style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              ×{weight}
            </span>
          )}
        </div>

        <div className="flex items-baseline gap-1 shrink-0">
          <motion.span
            className={`font-black tabular-nums transition-colors duration-500 ${large ? 'text-3xl' : 'text-xl'}`}
            style={{ color: hasScore ? style.color : 'var(--text-muted)' }}
            key={score}
            initial={{ scale: 0.85, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 250, damping: 20 }}
          >
            {hasScore ? <AnimatedNumber target={score} /> : '—'}
          </motion.span>
          {hasScore && (
            <span className={`${large ? 'text-sm' : 'text-xs'}`} style={{ color: 'var(--text-muted)' }}>
              /100
            </span>
          )}
        </div>
      </div>

      {/* Bar track */}
      <div className={`relative ${large ? 'h-4' : 'h-2.5'} rounded-full overflow-hidden`}
        style={{ background: 'rgba(255,255,255,0.04)' }}>

        {/* Segment markers */}
        <div className="absolute inset-0 flex pointer-events-none">
          {[20, 40, 60, 80].map((p) => (
            <div key={p} className="absolute inset-y-0 w-px" style={{ left: `${p}%`, background: 'rgba(255,255,255,0.05)' }} />
          ))}
        </div>

        {/* Scanning shimmer (shown while AI is working and no score yet) */}
        {isScanning && !hasScore && (
          <motion.div
            className="absolute inset-y-0 w-1/3 rounded-full"
            animate={{ left: ['-33%', '100%'] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            style={{ background: `linear-gradient(90deg, transparent, var(--accent-dim), transparent)` }}
          />
        )}

        {/* Fill */}
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: hasScore ? `${score}%` : '0%', opacity: hasScore ? 1 : 0 }}
          transition={{ type: 'spring', stiffness: 45, damping: 16 }}
          style={{
            background: hasScore ? style.gradient : 'transparent',
            boxShadow: hasScore ? `0 0 ${large ? 20 : 12}px ${style.glow}` : 'none',
          }}
        />
      </div>

      {/* Reasoning */}
      {reasoning && (
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.3 }}
          className="text-xs leading-relaxed"
          style={{ color: 'var(--text-muted)', paddingLeft: '2px' }}
        >
          {reasoning}
        </motion.p>
      )}
    </motion.div>
  )
}
