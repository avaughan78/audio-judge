'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase'
import { Session, Team, Criteria } from '@/lib/types'
import { ThemeProvider } from '@/components/ThemeSelector'
import { themes } from '@/lib/themes'
import { useAppStore } from '@/lib/store'

type Tab = 'sessions' | 'teams' | 'criteria' | 'settings'

function Input({ value, onChange, placeholder, className = '' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string
}) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className={`w-full px-3 py-2 rounded-lg text-sm placeholder:text-[color:var(--text-muted)] focus:outline-none transition-colors ${className}`}
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
      onFocus={e => { e.currentTarget.style.borderColor = 'var(--border-hover)' }}
      onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
    />
  )
}

function Textarea({ value, onChange, placeholder, rows = 4 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number
}) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      className="w-full px-3 py-2 rounded-lg text-sm placeholder:text-[color:var(--text-muted)] focus:outline-none transition-colors resize-none"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
      onFocus={e => { e.currentTarget.style.borderColor = 'var(--border-hover)' }}
      onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
    />
  )
}

function Btn({ onClick, children, variant = 'primary', disabled = false, small = false }: {
  onClick: () => void; children: React.ReactNode; variant?: 'primary' | 'ghost' | 'danger'
  disabled?: boolean; small?: boolean
}) {
  const styles = {
    primary: { background: 'var(--accent)', color: 'white', border: '1px solid transparent' },
    ghost: { background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)', border: '1px solid var(--border)' },
    danger: { background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' },
  }
  return (
    <button onClick={onClick} disabled={disabled}
      className={`flex items-center gap-1.5 rounded-lg font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${small ? 'text-xs px-2.5 py-1.5' : 'text-sm px-4 py-2'}`}
      style={styles[variant]}>
      {children}
    </button>
  )
}

function Badge({ text, active }: { text: string; active: boolean }) {
  return (
    <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
      style={active
        ? { background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)' }
        : { background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

export default function AdminClient() {
  const [tab, setTab] = useState<Tab>('sessions')
  const { setThemeId } = useAppStore()
  const supabase = createClient()

  const [dbError, setDbError] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const [newSessionName, setNewSessionName] = useState('')
  const [brief, setBrief] = useState('')
  const [savingBrief, setSavingBrief] = useState(false)

  const [teams, setTeams] = useState<Team[]>([])
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamDesc, setNewTeamDesc] = useState('')

  const [criteria, setCriteria] = useState<Criteria[]>([])
  const [newCritName, setNewCritName] = useState('')
  const [newCritDesc, setNewCritDesc] = useState('')
  const [newCritWeight, setNewCritWeight] = useState('1')

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from('sessions').select('*').order('created_at', { ascending: false })
      if (error) { setDbError(`DB Error: ${error.message} (code: ${error.code})`); return }
      setDbError(null)
      if (data) {
        setSessions(data)
        const active = data.find((s) => s.is_active)
        if (active) { setActiveSession(active); setBrief(active.brief || '') }
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (!activeSession) return
    Promise.all([
      supabase.from('teams').select('*').eq('session_id', activeSession.id).order('order_index'),
      supabase.from('criteria').select('*').eq('session_id', activeSession.id).order('order_index'),
    ]).then(([{ data: t }, { data: c }]) => {
      if (t) setTeams(t)
      if (c) setCriteria(c)
    })
  }, [activeSession?.id])

  // ── Sessions ──
  const createSession = async () => {
    if (!newSessionName.trim()) return
    const { data, error } = await supabase.from('sessions').insert({ name: newSessionName.trim() }).select().single()
    if (error) { setDbError(`Create failed: ${error.message} (code: ${error.code})`); return }
    if (data) { setSessions((p) => [data, ...p]); setNewSessionName(''); setDbError(null) }
  }

  const activateSession = async (sess: Session) => {
    await supabase.from('sessions').update({ is_active: false }).neq('id', sess.id)
    const { data } = await supabase.from('sessions').update({ is_active: true }).eq('id', sess.id).select().single()
    if (data) {
      setSessions((p) => p.map((s) => ({ ...s, is_active: s.id === sess.id })))
      setActiveSession(data)
      setBrief(data.brief || '')
      setThemeId(data.theme_id || 'midnight')
    }
  }

  const deleteSession = async (id: string) => {
    if (!confirm('Delete this session and all its data?')) return
    await supabase.from('sessions').delete().eq('id', id)
    setSessions((p) => p.filter((s) => s.id !== id))
    if (activeSession?.id === id) { setActiveSession(null); setBrief('') }
  }

  const saveBrief = async () => {
    if (!activeSession) return
    setSavingBrief(true)
    await supabase.from('sessions').update({ brief: brief.trim() || null }).eq('id', activeSession.id)
    setActiveSession((p) => p ? { ...p, brief: brief.trim() || null } : null)
    setSavingBrief(false)
  }

  const setSessionTheme = async (themeId: string) => {
    if (!activeSession) return
    await supabase.from('sessions').update({ theme_id: themeId }).eq('id', activeSession.id)
    setActiveSession((p) => p ? { ...p, theme_id: themeId as any } : null)
    setThemeId(themeId as any)
  }

  // ── Teams ──
  const createTeam = async () => {
    if (!newTeamName.trim() || !activeSession) return
    const { data } = await supabase.from('teams').insert({
      session_id: activeSession.id, name: newTeamName.trim(),
      description: newTeamDesc.trim() || null, order_index: teams.length,
    }).select().single()
    if (data) { setTeams((p) => [...p, data]); setNewTeamName(''); setNewTeamDesc('') }
  }

  const deleteTeam = async (id: string) => {
    await supabase.from('teams').delete().eq('id', id)
    setTeams((p) => p.filter((t) => t.id !== id))
  }

  // ── Criteria ──
  const createCriteria = async () => {
    if (!newCritName.trim() || !activeSession) return
    const { data } = await supabase.from('criteria').insert({
      session_id: activeSession.id, name: newCritName.trim(),
      description: newCritDesc.trim() || null,
      weight: parseFloat(newCritWeight) || 1,
      order_index: criteria.length,
    }).select().single()
    if (data) { setCriteria((p) => [...p, data]); setNewCritName(''); setNewCritDesc(''); setNewCritWeight('1') }
  }

  const deleteCriteria = async (id: string) => {
    await supabase.from('criteria').delete().eq('id', id)
    setCriteria((p) => p.filter((c) => c.id !== id))
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'sessions', label: 'Sessions' },
    { id: 'teams', label: `Teams${activeSession ? ` (${teams.length})` : ''}` },
    { id: 'criteria', label: `Criteria${activeSession ? ` (${criteria.length})` : ''}` },
    { id: 'settings', label: 'Settings' },
  ]

  const NoSession = () => (
    <div className="flex items-center gap-2 rounded-xl p-4 text-sm"
      style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b' }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      Activate a session first — go to the Sessions tab
    </div>
  )

  return (
    <ThemeProvider>
      <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>

        {/* Ambient */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
          <div className="absolute -top-40 -left-40 w-80 h-80 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 65%)' }} />
        </div>

        {/* Header */}
        <header className="relative z-10 flex items-center justify-between px-6 h-14 sticky top-0"
          style={{ borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)' }}>
          <div className="flex items-center gap-3">
            <Link href="/" className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </Link>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--gradient-from), var(--gradient-to))' }}>
              <span className="text-[10px] font-black text-white">AJ</span>
            </div>
            <span className="text-sm font-bold gradient-text">AudioJudge</span>
            <span style={{ color: 'var(--text-muted)' }}>·</span>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Admin</span>
          </div>
          {activeSession && (
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#4ade80' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{activeSession.name}</span>
            </div>
          )}
        </header>

        {/* Tabs */}
        <div className="relative z-10 flex gap-0 px-6 pt-4" style={{ borderBottom: '1px solid var(--border)' }}>
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="px-4 py-2 text-sm transition-all border-b-2 -mb-px"
              style={{
                color: tab === t.id ? 'var(--accent)' : 'var(--text-muted)',
                borderColor: tab === t.id ? 'var(--accent)' : 'transparent',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <main className="relative z-10 max-w-2xl mx-auto px-6 py-8">
          <AnimatePresence mode="wait">

            {/* ── SESSIONS TAB ── */}
            {tab === 'sessions' && (
              <motion.div key="sessions" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-1">Sessions</h2>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Each session is a hackathon event. Activate one to begin judging.</p>
                </div>

                {/* Create */}
                <div className="glass rounded-xl p-4 space-y-3">
                  <p className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>New Session</p>
                  <div className="flex gap-2">
                    <Input value={newSessionName} onChange={setNewSessionName} placeholder="e.g. HackDay 2024" className="flex-1" />
                    <Btn onClick={createSession}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Create
                    </Btn>
                  </div>
                </div>

                {/* Active session: Brief + Theme */}
                {activeSession && (
                  <div className="glass rounded-xl p-4 space-y-5">
                    <p className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>
                      Active Session Config — {activeSession.name}
                    </p>

                    {/* Hackathon Brief */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                        Hackathon Brief
                      </label>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        Describe the hackathon theme, goals, and what you're looking for. The AI uses this to judge more accurately.
                      </p>
                      <Textarea
                        value={brief}
                        onChange={setBrief}
                        rows={6}
                        placeholder="e.g. This is a 24-hour hackathon focused on sustainability and climate tech. Teams should demonstrate a working prototype that addresses real environmental challenges. We value innovation, technical depth, and real-world viability..."
                      />
                      <div className="flex justify-end">
                        <Btn onClick={saveBrief} disabled={savingBrief}>
                          {savingBrief ? 'Saving...' : 'Save Brief'}
                        </Btn>
                      </div>
                    </div>

                    {/* Theme */}
                    <div className="space-y-3">
                      <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                        Display Theme
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {themes.map((theme) => {
                          const isSelected = (activeSession.theme_id || 'midnight') === theme.id
                          return (
                            <button key={theme.id} onClick={() => setSessionTheme(theme.id)}
                              className="flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                              style={{
                                background: isSelected ? 'var(--accent-dim)' : 'rgba(255,255,255,0.03)',
                                border: `1px solid ${isSelected ? 'var(--border-hover)' : 'var(--border)'}`,
                              }}>
                              <div className="w-8 h-8 rounded-full shrink-0"
                                style={{ background: theme.swatch, boxShadow: isSelected ? `0 0 12px ${theme.vars.glowAccent}` : 'none' }} />
                              <div>
                                <p className="text-sm font-medium" style={{ color: isSelected ? 'var(--accent)' : 'var(--text-secondary)' }}>
                                  {theme.name}
                                </p>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{theme.description}</p>
                              </div>
                              {isSelected && (
                                <svg className="ml-auto shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none"
                                  stroke="var(--accent)" strokeWidth="2.5">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Session list */}
                <div className="space-y-2">
                  {sessions.map((sess) => (
                    <div key={sess.id} className="glass glass-hover rounded-xl px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{sess.name}</span>
                          <Badge text={sess.is_active ? 'Active' : 'Inactive'} active={sess.is_active} />
                        </div>
                        {sess.brief && (
                          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                            {sess.brief.slice(0, 80)}...
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {!sess.is_active && (
                          <Btn onClick={() => activateSession(sess)} variant="ghost" small>Activate</Btn>
                        )}
                        <button onClick={() => deleteSession(sess.id)}
                          className="p-1.5 rounded-lg transition-all"
                          style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ef4444'; (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                  {sessions.length === 0 && (
                    <p className="text-sm text-center py-10" style={{ color: 'var(--text-muted)' }}>No sessions yet</p>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── TEAMS TAB ── */}
            {tab === 'teams' && (
              <motion.div key="teams" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-1">Teams</h2>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    {activeSession ? `Teams for "${activeSession.name}"` : 'Activate a session to manage teams'}
                  </p>
                </div>

                {!activeSession ? <NoSession /> : (
                  <>
                    <div className="glass rounded-xl p-4 space-y-3">
                      <p className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>Add Team</p>
                      <Input value={newTeamName} onChange={setNewTeamName} placeholder="Team name" />
                      <Input value={newTeamDesc} onChange={setNewTeamDesc} placeholder="Short description (optional)" />
                      <Btn onClick={createTeam}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Add Team
                      </Btn>
                    </div>

                    <div className="space-y-2">
                      {teams.map((team, i) => (
                        <div key={team.id} className="glass rounded-xl px-4 py-3 flex items-center gap-3">
                          <span className="text-xs w-6 text-center font-mono" style={{ color: 'var(--text-muted)' }}>{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{team.name}</p>
                            {team.description && <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{team.description}</p>}
                          </div>
                          <button onClick={() => deleteTeam(team.id)}
                            className="p-1.5 rounded-lg transition-all"
                            style={{ color: 'var(--text-muted)' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ef4444'; (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                            </svg>
                          </button>
                        </div>
                      ))}
                      {teams.length === 0 && <p className="text-sm text-center py-10" style={{ color: 'var(--text-muted)' }}>No teams yet</p>}
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* ── CRITERIA TAB ── */}
            {tab === 'criteria' && (
              <motion.div key="criteria" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-1">Judging Criteria</h2>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Define what the AI scores on. Descriptions help the AI judge accurately. Weights affect the overall score.
                  </p>
                </div>

                {!activeSession ? <NoSession /> : (
                  <>
                    <div className="glass rounded-xl p-4 space-y-3">
                      <p className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>Add Criteria</p>
                      <Input value={newCritName} onChange={setNewCritName} placeholder="Name (e.g. Innovation)" />
                      <Textarea value={newCritDesc} onChange={setNewCritDesc} rows={2}
                        placeholder="Description for the AI (e.g. How novel and creative is the idea? Does it solve a problem in a new way?)" />
                      <div className="flex items-end gap-3">
                        <div className="w-32">
                          <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Weight</label>
                          <Input value={newCritWeight} onChange={setNewCritWeight} placeholder="1.0" />
                        </div>
                        <Btn onClick={createCriteria}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                          Add
                        </Btn>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {criteria.map((c, i) => (
                        <div key={c.id} className="glass rounded-xl px-4 py-3 flex items-start gap-3">
                          <span className="text-xs w-6 text-center font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{c.name}</p>
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                                style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--border-hover)' }}>
                                ×{c.weight}
                              </span>
                            </div>
                            {c.description && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{c.description}</p>}
                          </div>
                          <button onClick={() => deleteCriteria(c.id)}
                            className="p-1.5 rounded-lg transition-all mt-0.5 shrink-0"
                            style={{ color: 'var(--text-muted)' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ef4444'; (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                            </svg>
                          </button>
                        </div>
                      ))}
                      {criteria.length === 0 && <p className="text-sm text-center py-10" style={{ color: 'var(--text-muted)' }}>No criteria yet</p>}
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* ── SETTINGS TAB ── */}
            {tab === 'settings' && (
              <motion.div key="settings" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-1">Environment Variables</h2>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Set these in Railway → Service → Variables.</p>
                </div>

                <div className="glass rounded-xl overflow-hidden divide-y" style={{ borderColor: 'var(--border)' }}>
                  {[
                    { key: 'NEXT_PUBLIC_SUPABASE_URL', label: 'Supabase URL', hint: 'From supabase.com → Project Settings → API' },
                    { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', label: 'Supabase Anon Key', hint: 'Public key, safe for browser' },
                    { key: 'SUPABASE_SERVICE_ROLE_KEY', label: 'Supabase Service Role Key', hint: 'Server-only — never exposed to browser' },
                    { key: 'DEEPGRAM_API_KEY', label: 'Deepgram API Key', hint: 'From console.deepgram.com' },
                    { key: 'DEEPGRAM_PROJECT_ID', label: 'Deepgram Project ID', hint: 'From console.deepgram.com → select project' },
                    { key: 'OPENAI_API_KEY', label: 'OpenAI API Key', hint: 'From platform.openai.com/api-keys' },
                  ].map(({ key, label, hint }) => (
                    <div key={key} className="px-4 py-3 flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{hint}</p>
                      </div>
                      <code className="text-[11px] px-2 py-1 rounded shrink-0 font-mono"
                        style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                        {key}
                      </code>
                    </div>
                  ))}
                </div>

                <div className="glass rounded-xl p-4 space-y-2">
                  <p className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>Supabase Setup</p>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Run the schema SQL in your Supabase SQL editor:</p>
                  <code className="block text-xs p-3 rounded-lg font-mono" style={{ background: 'rgba(0,0,0,0.3)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                    supabase/schema.sql
                  </code>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </main>
      </div>
    </ThemeProvider>
  )
}

