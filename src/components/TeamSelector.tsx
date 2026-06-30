'use client'

import { motion } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { createClient } from '@/lib/supabase'
import { Team } from '@/lib/types'

export function TeamSelector() {
  const teams = useAppStore((s) => s.teams)
  const session = useAppStore((s) => s.session)
  const activeTeam = useAppStore((s) => s.activeTeam)
  const isRecording = useAppStore((s) => s.isRecording)
  const setActiveTeam = useAppStore((s) => s.setActiveTeam)

  const handleSelect = async (team: Team) => {
    if (isRecording || activeTeam?.id === team.id) return
    setActiveTeam(team)
    if (session) {
      const supabase = createClient()
      await supabase.from('sessions').update({ active_team_id: team.id }).eq('id', session.id)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <span className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>
          Teams
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
        {teams.length === 0 ? (
          <p className="text-xs text-center mt-8 px-3" style={{ color: 'var(--text-muted)' }}>
            No teams — configure in Admin
          </p>
        ) : (
          teams.map((team, i) => {
            const isActive = activeTeam?.id === team.id
            return (
              <motion.button
                key={team.id}
                onClick={() => handleSelect(team)}
                disabled={isRecording}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04, duration: 0.25 }}
                className="w-full text-left px-3 py-2.5 rounded-lg transition-all duration-150 group relative overflow-hidden"
                style={{
                  background: isActive ? 'var(--accent-dim)' : 'transparent',
                  border: `1px solid ${isActive ? 'var(--border-hover)' : 'transparent'}`,
                  opacity: isRecording && !isActive ? 0.35 : 1,
                  cursor: isRecording && !isActive ? 'not-allowed' : 'pointer',
                }}
              >
                {isActive && (
                  <motion.div
                    layoutId="team-indicator"
                    className="absolute left-0 inset-y-0 w-0.5 rounded-full"
                    style={{ background: 'var(--accent)' }}
                  />
                )}
                <div className="flex items-center gap-2 pl-1">
                  <span className={`text-sm font-medium truncate transition-colors`}
                    style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}>
                    {team.name}
                  </span>
                </div>
                {team.description && (
                  <p className="text-xs mt-0.5 pl-1 truncate" style={{ color: 'var(--text-muted)' }}>
                    {team.description}
                  </p>
                )}
              </motion.button>
            )
          })
        )}
      </div>
    </div>
  )
}
