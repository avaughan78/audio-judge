'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { createClient } from '@/lib/supabase'
import { Session } from '@/lib/types'

export function SessionSelector() {
  const sessions = useAppStore((s) => s.sessions)
  const event = useAppStore((s) => s.event)
  const activeSession = useAppStore((s) => s.activeSession)
  const isRecording = useAppStore((s) => s.isRecording)
  const setActiveSession = useAppStore((s) => s.setActiveSession)
  const setScores = useAppStore((s) => s.setScores)

  const handleSelect = async (session: Session) => {
    if (isRecording || activeSession?.id === session.id) return
    setActiveSession(session)

    if (event) {
      const supabase = createClient()
      const [, { data: existingScores }] = await Promise.all([
        supabase.from('sessions').update({ active_team_id: session.id }).eq('id', event.id),
        supabase.from('scores').select('*').eq('session_id', event.id).eq('team_id', session.id),
      ])
      if (existingScores?.length) {
        const map: Record<string, import('@/lib/types').Score> = {}
        existingScores.forEach((s) => { map[s.criteria_id] = s })
        setScores(map)
      }
    }
  }

  if (sessions.length === 0) {
    return (
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>No participants — configure in Admin</span>
    )
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
      {sessions.map((session, i) => {
        const isActive = activeSession?.id === session.id
        return (
          <motion.button
            key={session.id}
            onClick={() => handleSelect(session)}
            disabled={isRecording && !isActive}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.2 }}
            className="shrink-0 relative px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-150 whitespace-nowrap"
            style={{
              background: isActive ? 'var(--accent-dim)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${isActive ? 'var(--border-hover)' : 'var(--border)'}`,
              color: isActive ? 'var(--accent)' : 'var(--text-muted)',
              opacity: isRecording && !isActive ? 0.3 : 1,
              cursor: isRecording && !isActive ? 'not-allowed' : 'pointer',
            }}
          >
            {isActive && (
              <AnimatePresence>
                <motion.span
                  layoutId="session-pill-indicator"
                  className="absolute inset-0 rounded-full"
                  style={{ background: 'var(--accent-dim)', zIndex: -1 }}
                />
              </AnimatePresence>
            )}
            {session.name}
          </motion.button>
        )
      })}
    </div>
  )
}
