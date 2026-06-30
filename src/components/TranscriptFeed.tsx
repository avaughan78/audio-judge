'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '@/lib/store'

export function TranscriptFeed() {
  const transcript = useAppStore((s) => s.transcript)
  const isRecording = useAppStore((s) => s.isRecording)
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevWordCountRef = useRef(0)

  const words = transcript.split(/\s+/).filter(Boolean)

  useEffect(() => {
    if (words.length !== prevWordCountRef.current) {
      prevWordCountRef.current = words.length
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [words.length])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>
          Live Transcript
        </span>
        {isRecording && (
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                style={{ background: 'var(--score-low)' }} />
              <span className="relative inline-flex rounded-full h-2 w-2"
                style={{ background: 'var(--score-low)' }} />
            </span>
            <span className="text-[10px] font-bold tracking-widest" style={{ color: 'var(--score-low)' }}>LIVE</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {words.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: 'var(--text-muted)' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
            <p className="text-sm text-center">Transcript will appear here once recording begins</p>
          </div>
        ) : (
          <p className="text-sm leading-7 break-words font-mono" style={{ color: 'var(--text-secondary)' }}>
            {words.map((word, i) => (
              <motion.span
                key={`${word}-${i}`}
                initial={i >= prevWordCountRef.current - 1 ? { opacity: 0, y: 3 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="mr-1 inline-block"
              >
                {word}
              </motion.span>
            ))}
          </p>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
