'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useAppStore } from '@/lib/store'
import { createClient } from '@/lib/supabase'
import { TeamSelector } from '@/components/TeamSelector'
import { TranscriptFeed } from '@/components/TranscriptFeed'
import { TranscriptSummary } from '@/components/TranscriptSummary'
import { ScorePanel } from '@/components/ScorePanel'
import { RecordingControl } from '@/components/RecordingControl'
import { ThemeSelector, ThemeProvider } from '@/components/ThemeSelector'

export default function JudgePage() {
  const { session, setSession, setTeams, setCriteria, updateScore, setThemeId } = useAppStore()

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data: sess } = await supabase
        .from('sessions')
        .select('*')
        .eq('is_active', true)
        .maybeSingle()

      if (!sess) return
      setSession(sess)
      if (sess.theme_id) setThemeId(sess.theme_id)

      const [{ data: teams }, { data: criteria }] = await Promise.all([
        supabase.from('teams').select('*').eq('session_id', sess.id).order('order_index'),
        supabase.from('criteria').select('*').eq('session_id', sess.id).order('order_index'),
      ])

      if (teams) setTeams(teams)
      if (criteria) setCriteria(criteria)
    }

    load()

    const rt = createClient()
    let scoreChannel: any = null

    const sessionChannel = rt.channel('session-watch')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions' }, (payload: any) => {
        if (payload.new?.is_active) {
          setSession(payload.new)
          if (payload.new.theme_id) setThemeId(payload.new.theme_id)
        }
      })
      .subscribe()

    const unsub = useAppStore.subscribe((state) => {
      if (state.session && !scoreChannel) {
        scoreChannel = rt.channel('scores-live')
          .on('postgres_changes', {
            event: '*', schema: 'public', table: 'scores',
            filter: `session_id=eq.${state.session.id}`,
          }, (payload: any) => { if (payload.new) updateScore(payload.new) })
          .subscribe()
      }
    })

    return () => {
      rt.removeChannel(sessionChannel)
      if (scoreChannel) rt.removeChannel(scoreChannel)
      unsub()
    }
  }, [])

  return (
    <ThemeProvider>
      <div className="flex flex-col h-full" style={{ background: 'var(--bg)' }}>

        {/* Ambient orbs */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
          <div className="absolute -top-64 -left-64 w-[600px] h-[600px] rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 65%)' }} />
          <div className="absolute -bottom-64 -right-64 w-[500px] h-[500px] rounded-full opacity-15"
            style={{ background: 'radial-gradient(circle, var(--accent-secondary) 0%, transparent 65%)' }} />
        </div>

        {/* Header */}
        <header className="relative z-10 flex items-center justify-between px-5 h-14 shrink-0"
          style={{ borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(8px)' }}>
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--gradient-from), var(--gradient-to))' }}>
              <span className="text-[10px] font-black text-white">AJ</span>
            </div>
            <span className="text-sm font-bold gradient-text">AudioJudge</span>
            {session && (
              <>
                <span style={{ color: 'var(--text-muted)' }}>·</span>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{session.name}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-4">
            <ThemeSelector />
            <div className="w-px h-4" style={{ background: 'var(--border)' }} />
            <NavLink href="/display" target="_blank" label="Display" icon="external" />
            <NavLink href="/admin" label="Admin" icon="settings" />
          </div>
        </header>

        {!session ? (
          <div className="relative z-10 flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="text-6xl">🎯</div>
              <h2 className="text-xl font-semibold" style={{ color: 'var(--text-secondary)' }}>No active session</h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Create and activate a session in Admin to begin</p>
              <Link href="/admin" className="inline-block mt-2 text-sm underline underline-offset-4"
                style={{ color: 'var(--accent)' }}>
                Go to Admin →
              </Link>
            </div>
          </div>
        ) : (
          <div className="relative z-10 flex flex-1 overflow-hidden min-h-0">
            <div className="w-48 shrink-0 flex flex-col overflow-hidden" style={{ borderRight: '1px solid var(--border)' }}>
              <TeamSelector />
            </div>
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ borderRight: '1px solid var(--border)' }}>
              <div className="flex-1 min-h-0 overflow-hidden" style={{ borderBottom: '1px solid var(--border)' }}>
                <TranscriptFeed />
              </div>
              <div className="h-44 shrink-0 overflow-hidden">
                <TranscriptSummary />
              </div>
            </div>
            <div className="w-96 shrink-0 flex flex-col overflow-hidden">
              <ScorePanel />
            </div>
          </div>
        )}

        {session && <RecordingControl />}
      </div>
    </ThemeProvider>
  )
}

function NavLink({ href, label, icon, target }: { href: string; label: string; icon: string; target?: string }) {
  return (
    <Link href={href} target={target}
      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-colors"
      style={{ color: 'var(--text-muted)' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}>
      {icon === 'external' ? (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      ) : (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41M12 2v2M12 20v2M2 12h2M20 12h2" />
        </svg>
      )}
      {label}
    </Link>
  )
}
