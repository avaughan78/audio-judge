'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { useAudioCapture } from '@/hooks/useAudioCapture'

function useElapsedTime(startedAt: number | null) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!startedAt) { setElapsed(0); return }
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt])
  return elapsed
}

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

interface RecordingControlProps {
  compact?: boolean
  onStart?: () => Promise<void>
  onStop?: () => Promise<void>
  onPause?: () => void
  onResume?: () => void
  isPausedOverride?: boolean
}

export function RecordingControl({ compact = false, onStart, onStop, onPause, onResume, isPausedOverride }: RecordingControlProps) {
  const isRecording = useAppStore((s) => s.isRecording)
  const isConnecting = useAppStore((s) => s.isConnecting)
  const isSummarising = useAppStore((s) => s.isSummarising)
  const activeSession = useAppStore((s) => s.activeSession)
  const event = useAppStore((s) => s.event)
  const criteria = useAppStore((s) => s.criteria)
  const lastJudgedAt = useAppStore((s) => s.lastJudgedAt)
  const recordingStartedAt = useAppStore((s) => s.recordingStartedAt)
  const elapsed = useElapsedTime(recordingStartedAt)
  const { start: hookStart, stop: hookStop, pause: hookPause, resume: hookResume, isPaused: hookIsPaused } = useAudioCapture()
  const start = onStart ?? hookStart
  const stop = onStop ?? hookStop
  const pause = onPause ?? hookPause
  const resume = onResume ?? hookResume
  const isPaused = isPausedOverride !== undefined ? isPausedOverride : hookIsPaused

  const noCriteria = !!event && criteria.length === 0
  const canRecord = !!event && !isConnecting && criteria.length > 0
  const recordTitle = noCriteria ? 'Add scoring criteria in Events before recording' : undefined

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <AnimatePresence>
          {isRecording && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="text-xs font-mono tabular-nums px-2 py-1 rounded overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}
            >
              {formatTime(elapsed)}
            </motion.span>
          )}
          {isSummarising && (
            <motion.div
              key="scoring-dots"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center gap-1"
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-1 h-1 rounded-full"
                  style={{ background: 'var(--accent)' }}
                  animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 0.9, delay: i * 0.18, repeat: Infinity }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {isPaused ? (
          /* Paused state: Resume + Stop */
          <>
            <motion.button
              onClick={resume}
              disabled={!canRecord}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 disabled:opacity-40"
              style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--border-hover)' }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Resume
            </motion.button>
            <motion.button
              onClick={stop}
              disabled={!canRecord}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 disabled:opacity-40"
              style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--score-low)', border: '1px solid var(--score-low)' }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="3" width="18" height="18" rx="2" />
              </svg>
              Stop
            </motion.button>
          </>
        ) : isRecording ? (
          /* Recording state: Pause + Stop */
          <>
            <motion.button
              onClick={pause}
              whileTap={{ scale: 0.95 }}
              className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
              Pause
            </motion.button>
            <motion.button
              onClick={stop}
              whileTap={{ scale: 0.95 }}
              className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200"
              style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--score-low)', border: '1px solid var(--score-low)' }}
            >
              {isRecording && (
                <motion.span
                  className="absolute inset-0 rounded-full"
                  animate={{ scale: 1.2, opacity: 0 }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                  style={{ border: '1px solid var(--score-low)' }}
                />
              )}
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'currentColor' }} />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: 'currentColor' }} />
              </span>
              Stop
            </motion.button>
          </>
        ) : isConnecting ? (
          /* Connecting */
          <motion.button disabled className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold opacity-60"
            style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--border-hover)' }}>
            <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Connecting
          </motion.button>
        ) : (
          /* Idle: Record */
          <motion.button
            onClick={start}
            disabled={!canRecord}
            title={recordTitle}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: noCriteria ? 'transparent' : 'var(--accent-dim)', color: noCriteria ? 'var(--text-muted)' : 'var(--accent)', border: `1px solid ${noCriteria ? 'var(--border)' : 'var(--border-hover)'}` }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
            {noCriteria ? 'No criteria' : 'Record'}
          </motion.button>
        )}
      </div>
    )
  }

  // Full bar mode (legacy)
  return (
    <div className="relative z-20 shrink-0 px-5 py-3" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-glass)', backdropFilter: 'blur(12px)' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <AnimatePresence mode="wait">
            {isConnecting ? (
              <motion.div key="connecting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2" style={{ color: 'var(--score-mid)' }}>
                <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                <span className="text-xs">Connecting to Deepgram...</span>
              </motion.div>
            ) : isPaused ? (
              <motion.div key="paused" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-sm shrink-0" style={{ background: 'var(--text-muted)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Paused — session open</span>
              </motion.div>
            ) : isRecording ? (
              <motion.div key="recording" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-3">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--score-low)' }} />
                  <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: 'var(--score-low)' }} />
                </span>
                <span className="text-xs font-medium" style={{ color: 'var(--score-low)' }}>
                  {activeSession ? activeSession.name : 'Recording'}
                </span>
                <span className="text-xs font-mono tabular-nums px-2 py-0.5 rounded"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
                  {formatTime(elapsed)}
                </span>
                {isSummarising && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>· Scoring...</span>}
              </motion.div>
            ) : (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {activeSession ? `Ready · ${activeSession.name}` : 'Ready'}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {lastJudgedAt > 0 && !isRecording && !isPaused && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Last scored {new Date(lastJudgedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isPaused ? (
            <>
              <motion.button onClick={resume} disabled={!canRecord} whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-40"
                style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--border-hover)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                Resume
              </motion.button>
              <motion.button onClick={stop} disabled={!canRecord} whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-40"
                style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--score-low)', border: '1px solid var(--score-low)' }}>
                Stop
              </motion.button>
            </>
          ) : (
            <motion.button
              onClick={isRecording ? pause : start}
              disabled={!canRecord}
              whileTap={{ scale: 0.95 }}
              className="relative flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: isRecording ? 'rgba(255,255,255,0.06)' : 'var(--accent-dim)',
                color: isRecording ? 'var(--text-secondary)' : 'var(--accent)',
                border: `1px solid ${isRecording ? 'var(--border)' : 'var(--border-hover)'}`,
              }}
            >
              {isConnecting ? (
                <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              ) : isRecording ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                  Pause
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                  </svg>
                  Start Recording
                </>
              )}
            </motion.button>
          )}
          {isRecording && (
            <motion.button onClick={stop} whileTap={{ scale: 0.95 }}
              className="relative flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold"
              style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--score-low)', border: '1px solid var(--score-low)' }}>
              <motion.span className="absolute inset-0 rounded-full"
                animate={{ scale: 1.2, opacity: 0 }}
                transition={{ duration: 1.4, repeat: Infinity }}
                style={{ border: '1px solid var(--score-low)' }} />
              Stop
            </motion.button>
          )}
        </div>
      </div>
    </div>
  )
}
