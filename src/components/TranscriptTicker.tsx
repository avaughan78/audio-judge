'use client'

import { useAppStore } from '@/lib/store'

const TAIL_WORDS = 22

export function TranscriptTicker() {
  const transcript = useAppStore((s) => s.transcript)
  const interimTranscript = useAppStore((s) => s.interimTranscript)
  const isRecording = useAppStore((s) => s.isRecording)

  const words = transcript.split(/\s+/).filter(Boolean)
  const tail = words.slice(-TAIL_WORDS).join(' ')
  const hasText = tail.length > 0 || !!interimTranscript

  return (
    <div className="shrink-0 flex items-center gap-3 px-5 py-2.5"
      style={{ borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)', minHeight: '38px' }}>
      {isRecording && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ background: 'var(--score-low)' }} />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5"
            style={{ background: 'var(--score-low)' }} />
        </span>
      )}
      <p className="text-xs font-mono flex-1 truncate" style={{ color: 'var(--text-muted)' }}>
        {hasText
          ? <>{tail}{interimTranscript && <span className="italic ml-1" style={{ opacity: 0.5 }}>{interimTranscript}</span>}</>
          : isRecording ? 'Listening…' : 'Live transcript will appear here once recording begins'
        }
      </p>
    </div>
  )
}
