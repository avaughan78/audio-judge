'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAppStore } from '@/lib/store'

export function TranscriptSummary({ fullHeight = false }: { fullHeight?: boolean }) {
  const summary = useAppStore((s) => s.summary)
  const isSummarising = useAppStore((s) => s.isSummarising)
  const lastJudgedAt = useAppStore((s) => s.lastJudgedAt)
  const [expanded, setExpanded] = useState(false)

  const timeStr = lastJudgedAt
    ? new Date(lastJudgedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null

  const rootStyle = fullHeight
    ? { height: '100%' }
    : { height: expanded ? 'auto' : '130px', minHeight: '130px', transition: 'height 0.2s ease' }

  return (
    <div className="flex flex-col" style={rootStyle}>
      <div className="flex items-center justify-between px-4 py-2.5 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-secondary)" strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>
            AI Summary
          </span>
        </div>
        <div className="flex items-center gap-3">
          {isSummarising && (
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-1 h-1 rounded-full"
                  style={{ background: 'var(--accent-secondary)' }}
                  animate={{ scale: [1, 1.6, 1], opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 0.9, delay: i * 0.18, repeat: Infinity }}
                />
              ))}
            </div>
          )}
          {timeStr && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Updated {timeStr}</span>
          )}
          {!fullHeight && summary && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-xs px-1.5 py-0.5 rounded transition-colors"
              style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}>
              {expanded ? 'Collapse' : 'Expand'}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 p-4 overflow-y-auto min-h-0">
        <AnimatePresence mode="wait">
          {summary ? (
            <motion.p
              key={summary.slice(0, 40)}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35 }}
              className="text-sm leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              {summary}
            </motion.p>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-full gap-2"
              style={{ color: 'var(--text-muted)' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <p className="text-xs text-center">Summary appears after first scoring cycle (~20s)</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
