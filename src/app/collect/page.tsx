'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase'
import { useCollectorCapture, CaptureMode } from '@/hooks/useCollectorCapture'
import { useSessionPresence } from '@/hooks/useSessionPresence'
import { getDeviceId } from '@/lib/deviceId'
import { ThemeProvider, ThemeSelector } from '@/components/ThemeSelector'
import { applyTheme, themeMap } from '@/lib/themes'
import { useAppStore } from '@/lib/store'
import type { Session, Team, ThemeId } from '@/lib/types'

export default function CollectPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [activeTeam, setActiveTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)
  const setThemeId = useAppStore((s) => s.setThemeId)
  const [captureMode, setCaptureMode] = useState<CaptureMode>(() => {
    try { return (localStorage.getItem('aj_capture_mode') as CaptureMode) ?? 'local' } catch { return 'local' }
  })
  const deviceId = getDeviceId()

  const { start, stop, isRecording, isConnecting, transcript, interimTranscript, hasWakeLock } =
    useCollectorCapture(session?.id ?? null, activeTeam?.id ?? null, captureMode)

  const setMode = (m: CaptureMode) => {
    setCaptureMode(m)
    try { localStorage.setItem('aj_capture_mode', m) } catch {}
  }

  const { peers } = useSessionPresence(session?.id ?? null, deviceId, 'collector', isRecording)
  const judgeOnline = peers.some((p) => p.role === 'judge')
  const judgeRecording = peers.some((p) => p.role === 'judge' && p.isRecording)
  const otherCollectors = peers.filter((p) => p.role === 'collector')

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data: sess } = await supabase
        .from('sessions').select('*').eq('is_active', true).maybeSingle()
      if (!sess) { setLoading(false); return }
      setSession(sess)
      if (sess.theme_id && themeMap[sess.theme_id as ThemeId]) { applyTheme(themeMap[sess.theme_id as ThemeId]); setThemeId(sess.theme_id as ThemeId) }
      if (sess.active_team_id) {
        const { data: team } = await supabase.from('teams').select('*').eq('id', sess.active_team_id).single()
        if (team) setActiveTeam(team)
      }
      setLoading(false)
    }
    load()

    const channel = supabase.channel('collect-session')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions' }, async (payload: any) => {
        const updated = payload.new as Session
        if (!updated.is_active) return
        setSession(updated)
        if (updated.theme_id && themeMap[updated.theme_id as ThemeId]) applyTheme(themeMap[updated.theme_id as ThemeId])
        if (updated.active_team_id) {
          const { data: team } = await supabase.from('teams').select('*').eq('id', updated.active_team_id).single()
          if (team) setActiveTeam(team)
        } else {
          setActiveTeam(null)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const words = transcript.split(/\s+/).filter(Boolean)
  const tail = words.slice(-30).join(' ')

  return (
    <ThemeProvider>
      <div className="flex flex-col h-full" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>

        {/* Ambient orb */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
          <div className="absolute -top-64 -left-64 w-[500px] h-[500px] rounded-full opacity-15"
            style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 65%)' }} />
        </div>

        {/* Header */}
        <header className="relative z-10 flex items-center justify-between px-5 h-12 shrink-0"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-glass)', backdropFilter: 'blur(8px)' }}>
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--gradient-from), var(--gradient-to))' }}>
              <span className="text-[9px] font-black text-white">AJ</span>
            </div>
            <span className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>AudioJudge</span>
            <span style={{ color: 'var(--text-muted)' }}>·</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--border-hover)' }}>
              Collector
            </span>
          </div>
          <div className="flex items-center gap-3">
            {session && (
              <span className="hidden sm:inline text-xs truncate max-w-[160px]" style={{ color: 'var(--text-muted)' }}>{session.name}</span>
            )}
            <ThemeSelector />
          </div>
        </header>

        {/* Body */}
        {loading ? (
          <div className="relative z-10 flex-1 flex items-center justify-center">
            <div className="w-5 h-5 rounded-full border-2 animate-spin"
              style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
          </div>
        ) : !session ? (
          <div className="relative z-10 flex-1 flex items-center justify-center text-center px-8">
            <div className="space-y-3">
              <p className="text-lg font-semibold" style={{ color: 'var(--text-secondary)' }}>No active session</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Ask the organiser to activate a session in Admin.</p>
            </div>
          </div>
        ) : (
          <div className="relative z-10 flex flex-col flex-1 overflow-hidden min-h-0 items-center justify-center px-8 gap-8">

            {/* Current presenter */}
            <div className="text-center">
              <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: 'var(--text-muted)' }}>
                Now presenting
              </p>
              <AnimatePresence mode="wait">
                <motion.p
                  key={activeTeam?.id ?? 'none'}
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                  className="text-2xl font-black"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {activeTeam?.name ?? 'Waiting…'}
                </motion.p>
              </AnimatePresence>
            </div>

            {/* Connection status */}
            <div className="flex items-center gap-3 flex-wrap justify-center">
              <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
                style={{
                  background: judgeOnline ? 'rgba(16,185,129,0.1)' : 'var(--bg-card)',
                  color: judgeOnline ? 'var(--score-high)' : 'var(--text-muted)',
                  border: `1px solid ${judgeOnline ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
                  transition: 'all 0.3s ease',
                }}>
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  {judgeOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'currentColor' }} />}
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: 'currentColor' }} />
                </span>
                Judge {judgeOnline ? 'online' : 'offline'}
              </div>
              {otherCollectors.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
                  style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--border-hover)' }}>
                  +{otherCollectors.length} other mic{otherCollectors.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>

            {/* Capture mode toggle */}
            <div className="flex rounded-xl overflow-hidden text-xs font-medium"
              style={{ border: '1px solid var(--border)', opacity: isRecording ? 0.4 : 1, pointerEvents: isRecording ? 'none' : 'auto' }}>
              {([
                { value: 'local', label: 'Local audio', icon: (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" />
                  </svg>
                )},
                { value: 'online', label: 'Online meeting', icon: (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="7" width="15" height="12" rx="2" />
                    <path d="M17 11l4-3v8l-4-3" />
                  </svg>
                )},
              ] as const).map(({ value, label, icon }) => (
                <button key={value} onClick={() => setMode(value)}
                  className="flex items-center gap-1.5 px-3 py-2 transition-all"
                  style={{
                    background: captureMode === value ? 'var(--accent-dim)' : 'transparent',
                    color: captureMode === value ? 'var(--accent)' : 'var(--text-muted)',
                    borderRight: value === 'local' ? '1px solid var(--border)' : 'none',
                  }}>
                  {icon}
                  {label}
                </button>
              ))}
            </div>

            {/* Big record button */}
            {!judgeRecording && !isRecording && (
              <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                Waiting for the judge to start recording…
              </p>
            )}

            <motion.button
              onClick={isRecording ? stop : start}
              disabled={isConnecting || !activeTeam || (!isRecording && !judgeRecording)}
              whileTap={{ scale: 0.94 }}
              className="relative w-28 h-28 rounded-full flex flex-col items-center justify-center gap-2 font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: isRecording ? 'rgba(239,68,68,0.12)' : 'var(--accent-dim)',
                border: `2px solid ${isRecording ? 'var(--score-low)' : 'var(--accent)'}`,
                color: isRecording ? 'var(--score-low)' : 'var(--accent)',
              }}
            >
              {isRecording && (
                <motion.span
                  className="absolute inset-0 rounded-full"
                  animate={{ scale: 1.18, opacity: 0 }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                  style={{ border: '2px solid var(--score-low)' }}
                />
              )}
              {isConnecting ? (
                <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              ) : isRecording ? (
                <>
                  <span className="relative flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'currentColor' }} />
                    <span className="relative inline-flex h-4 w-4 rounded-full" style={{ background: 'currentColor' }} />
                  </span>
                  <span>Stop</span>
                </>
              ) : (
                <>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                  </svg>
                  <span>Record</span>
                </>
              )}
            </motion.button>

            {/* Wake lock / screen warning */}
            {isRecording && (
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-xs"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                  <line x1="12" y1="18" x2="12.01" y2="18" />
                </svg>
                {hasWakeLock
                  ? 'Screen will stay on · do not switch apps'
                  : 'Keep this screen on and do not switch apps'}
              </motion.div>
            )}
          </div>
        )}

        {/* Live transcript strip */}
        <div className="shrink-0 flex items-center gap-3 px-5 py-2.5 relative z-10"
          style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-glass)', backdropFilter: 'blur(8px)', minHeight: '38px' }}>
          {isRecording && (
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--score-low)' }} />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: 'var(--score-low)' }} />
            </span>
          )}
          <p className="text-xs font-mono flex-1 truncate" style={{ color: 'var(--text-muted)' }}>
            {tail || interimTranscript
              ? <>{tail}{interimTranscript && <span className="italic ml-1" style={{ opacity: 0.5 }}>{interimTranscript}</span>}</>
              : isRecording ? 'Listening…' : 'Transcript will appear here once recording begins'
            }
          </p>
        </div>
      </div>
    </ThemeProvider>
  )
}
