'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { createClient } from '@/lib/supabase'
import { Team } from '@/lib/types'

export function TeamSelector() {
  const teams = useAppStore((s) => s.teams)
  const session = useAppStore((s) => s.session)
  const activeTeam = useAppStore((s) => s.activeTeam)
  const isRecording = useAppStore((s) => s.isRecording)
  const setActiveTeam = useAppStore((s) => s.setActiveTeam)
  const setScores = useAppStore((s) => s.setScores)

  const handleSelect = async (team: Team) => {
    if (isRecording || activeTeam?.id === team.id) return
    setActiveTeam(team)

    if (session) {
      const supabase = createClient()
      const [, { data: existingScores }] = await Promise.all([
        supabase.from('sessions').update({ active_team_id: team.id }).eq('id', session.id),
        supabase.from('scores').select('*').eq('session_id', session.id).eq('team_id', team.id),
      ])
      if (existingScores?.length) {
        const map: Record<string, import('@/lib/types').Score> = {}
        existingScores.forEach((s) => { map[s.criteria_id] = s })
        setScores(map)
      }
    }
  }

  if (teams.length === 0) {
    return (
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>No participants — configure in Admin</span>
    )
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
      {teams.map((team, i) => {
        const isActive = activeTeam?.id === team.id
        return (
          <motion.button
            key={team.id}
            onClick={() => handleSelect(team)}
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
                  layoutId="team-pill-indicator"
                  className="absolute inset-0 rounded-full"
                  style={{ background: 'var(--accent-dim)', zIndex: -1 }}
                />
              </AnimatePresence>
            )}
            {team.name}
          </motion.button>
        )
      })}
    </div>
  )
}
