'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase'
import { Session, Team, Criteria } from '@/lib/types'
import { ThemeProvider } from '@/components/ThemeSelector'
import { themes } from '@/lib/themes'
import { useAppStore } from '@/lib/store'

// ── Default content ─────────────────────────────────────────────────────────

const BRIEF_PLACEHOLDER = `e.g. This is a 24-hour open innovation hackathon. Teams present a working prototype that solves a real problem — ideally something novel, not a thin layer on an existing product. We want to see the product working, not slides about what it might do. Technical ambition matters, but so does clarity: if you can't explain the problem and solution in 60 seconds, that's a gap.\n\nThis context helps the AI understand what good looks like and score accordingly.`

const DEFAULT_CRITERIA = [
  {
    name: 'Innovation',
    description: 'How original is the idea? Does it approach the problem in a genuinely new way, or is it incremental? Look for unexpected angles, novel combinations, or ideas that challenge assumptions. Penalise ideas that are obvious extensions of existing products.',
    weight: 1.5,
  },
  {
    name: 'Technical Execution',
    description: 'Is there a working prototype? How solid is the implementation — does it actually function, or is it held together with string? Award higher scores for real working code over mocked-up demos. Consider technical complexity relative to the time available.',
    weight: 1.5,
  },
  {
    name: 'Problem Clarity',
    description: 'Has the team clearly defined the problem they\'re solving and who has it? Do they have evidence the problem is real? Vague or assumed problems should score lower even if the solution is impressive.',
    weight: 1,
  },
  {
    name: 'Impact Potential',
    description: 'If this succeeded at scale, how much would it matter? Consider the size of the problem, the realism of the solution\'s reach, and whether the team has thought through what success actually looks like.',
    weight: 1,
  },
  {
    name: 'Presentation',
    description: 'Is the pitch clear, confident, and well-structured? Does the team communicate the idea quickly and make the demo easy to follow? Penalise pitches that spend too long on background and not enough on the product itself.',
    weight: 0.5,
  },
]

// ── Primitives ──────────────────────────────────────────────────────────────

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
      className={`flex items-center gap-1.5 rounded-lg font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap ${small ? 'text-xs px-2.5 py-1.5' : 'text-sm px-4 py-2'}`}
      style={styles[variant]}>
      {children}
    </button>
  )
}

function SectionHeading({ step, title, subtitle }: { step: number; title: string; subtitle?: string }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-black"
        style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--border-hover)' }}>
        {step}
      </div>
      <div>
        <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
        {subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
      </div>
    </div>
  )
}

function DeleteBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="p-1.5 rounded-lg transition-all shrink-0"
      style={{ color: 'var(--text-muted)' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ef4444'; (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
      </svg>
    </button>
  )
}

// ── Main ────────────────────────────────────────────────────────────────────

export default function AdminClient() {
  const { setThemeId } = useAppStore()
  const supabase = createClient()

  const [dbError, setDbError] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const [showAllSessions, setShowAllSessions] = useState(false)

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

  const [showEnvVars, setShowEnvVars] = useState(false)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from('sessions').select('*').order('created_at', { ascending: false })
      if (error) {
        setDbError(error.code === '42P01'
          ? 'Database tables not found — run supabase/schema.sql in your Supabase SQL editor first.'
          : `DB error: ${error.message}`)
        return
      }
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

  // ── Sessions ──────────────────────────────────────────────────────────────

  const activateSession = async (sess: Session) => {
    await supabase.from('sessions').update({ is_active: false }).neq('id', sess.id)
    const { data } = await supabase.from('sessions').update({ is_active: true }).eq('id', sess.id).select().single()
    if (data) {
      setSessions((p) => p.map((s) => ({ ...s, is_active: s.id === sess.id })))
      setActiveSession(data)
      setBrief(data.brief || '')
      setThemeId(data.theme_id || 'midnight')
      setTeams([])
      setCriteria([])
    }
  }

  const createSession = async () => {
    if (!newSessionName.trim()) return
    // Deactivate current
    if (activeSession) {
      await supabase.from('sessions').update({ is_active: false }).eq('id', activeSession.id)
    }
    const { data, error } = await supabase
      .from('sessions')
      .insert({ name: newSessionName.trim(), is_active: true })
      .select().single()
    if (error) { setDbError(`Create failed: ${error.message}`); return }
    if (data) {
      setSessions((p) => [data, ...p.map(s => ({ ...s, is_active: false }))])
      setActiveSession(data)
      setBrief('')
      setTeams([])
      setCriteria([])
      setNewSessionName('')
      setDbError(null)
    }
  }

  const deleteSession = async (id: string) => {
    if (!confirm('Delete this session and all its data?')) return
    await supabase.from('sessions').delete().eq('id', id)
    setSessions((p) => p.filter((s) => s.id !== id))
    if (activeSession?.id === id) { setActiveSession(null); setBrief(''); setTeams([]); setCriteria([]) }
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

  // ── Teams ─────────────────────────────────────────────────────────────────

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

  // ── Criteria ──────────────────────────────────────────────────────────────

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

  const addDefaultCriteria = async () => {
    if (!activeSession) return
    const rows = DEFAULT_CRITERIA.map((c, i) => ({
      session_id: activeSession.id,
      name: c.name,
      description: c.description,
      weight: c.weight,
      order_index: criteria.length + i,
    }))
    const { data } = await supabase.from('criteria').insert(rows).select()
    if (data) setCriteria((p) => [...p, ...data])
  }

  const inactiveSessions = sessions.filter((s) => !s.is_active)

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
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Setup</span>
          </div>
          {activeSession && (
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#4ade80' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{activeSession.name}</span>
            </div>
          )}
        </header>

        <main className="relative z-10 max-w-xl mx-auto px-6 py-8 space-y-8">

          {/* DB error */}
          {dbError && (
            <div className="rounded-xl p-4 text-sm"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
              {dbError}
            </div>
          )}

          {/* ── Step 1: Session ──────────────────────────────────────────── */}
          <section>
            <SectionHeading step={1} title="Session" subtitle="One session per event. Creating a new one activates it automatically." />

            <div className="space-y-3">
              {/* Create form */}
              <div className="glass rounded-xl p-4">
                <div className="flex gap-2">
                  <Input value={newSessionName} onChange={setNewSessionName}
                    placeholder="Session name — e.g. HackDay 2025"
                    className="flex-1" />
                  <Btn onClick={createSession} disabled={!newSessionName.trim()}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Create
                  </Btn>
                </div>
              </div>

              {/* Active session */}
              {activeSession && (
                <div className="glass rounded-xl px-4 py-3 flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: '#4ade80' }} />
                  <span className="text-sm font-medium flex-1">{activeSession.name}</span>
                  <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)' }}>
                    Active
                  </span>
                  <DeleteBtn onClick={() => deleteSession(activeSession.id)} />
                </div>
              )}

              {/* Other sessions (collapsible) */}
              {inactiveSessions.length > 0 && (
                <div>
                  <button onClick={() => setShowAllSessions(v => !v)}
                    className="flex items-center gap-1.5 text-xs py-1"
                    style={{ color: 'var(--text-muted)' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                      style={{ transform: showAllSessions ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    {inactiveSessions.length} other session{inactiveSessions.length !== 1 ? 's' : ''}
                  </button>
                  <AnimatePresence>
                    {showAllSessions && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }} className="space-y-1.5 mt-1.5 overflow-hidden">
                        {inactiveSessions.map((sess) => (
                          <div key={sess.id} className="glass rounded-xl px-4 py-2.5 flex items-center gap-3">
                            <span className="text-sm flex-1 truncate" style={{ color: 'var(--text-muted)' }}>{sess.name}</span>
                            <Btn onClick={() => activateSession(sess)} variant="ghost" small>Activate</Btn>
                            <DeleteBtn onClick={() => deleteSession(sess.id)} />
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </section>

          {/* Steps 2–5 only visible once a session is active */}
          <AnimatePresence>
            {activeSession && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }} className="space-y-8">

                {/* ── Step 2: Context ──────────────────────────────────── */}
                <section>
                  <SectionHeading step={2} title="Context"
                    subtitle="What are you evaluating, and what does success look like? The AI uses this to score more accurately." />
                  <div className="glass rounded-xl p-4 space-y-3">
                    <Textarea value={brief} onChange={setBrief} rows={5}
                      placeholder={BRIEF_PLACEHOLDER} />
                    <div className="flex justify-end">
                      <Btn onClick={saveBrief} disabled={savingBrief}>
                        {savingBrief ? 'Saving…' : 'Save Context'}
                      </Btn>
                    </div>
                  </div>
                </section>

                {/* ── Step 3: Participants ─────────────────────────────── */}
                <section>
                  <SectionHeading step={3} title={`Participants${teams.length ? ` (${teams.length})` : ''}`}
                    subtitle="Add each team, candidate, or presenter being evaluated." />
                  <div className="space-y-2">
                    <div className="glass rounded-xl p-4 space-y-2">
                      <div className="flex gap-2">
                        <Input value={newTeamName} onChange={setNewTeamName} placeholder="Name — e.g. Team Alpha, Candidate A" className="flex-1" />
                        <Btn onClick={createTeam} disabled={!newTeamName.trim()}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                          Add
                        </Btn>
                      </div>
                      <Input value={newTeamDesc} onChange={setNewTeamDesc} placeholder="Short description (optional)" />
                    </div>

                    {teams.map((team, i) => (
                      <div key={team.id} className="glass rounded-xl px-4 py-3 flex items-center gap-3">
                        <span className="text-xs w-5 text-center font-mono shrink-0" style={{ color: 'var(--text-muted)' }}>{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{team.name}</p>
                          {team.description && <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{team.description}</p>}
                        </div>
                        <DeleteBtn onClick={() => deleteTeam(team.id)} />
                      </div>
                    ))}

                    {teams.length === 0 && (
                      <p className="text-xs text-center py-3" style={{ color: 'var(--text-muted)' }}>No participants yet</p>
                    )}
                  </div>
                </section>

                {/* ── Step 4: Criteria ─────────────────────────────────── */}
                <section>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-black"
                        style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--border-hover)' }}>
                        4
                      </div>
                      <div>
                        <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                          {`Scoring Criteria${criteria.length ? ` (${criteria.length})` : ''}`}
                        </h2>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>What the AI scores on. Specific descriptions lead to better, more reliable scores.</p>
                      </div>
                    </div>
                    {criteria.length === 0 && (
                      <button onClick={addDefaultCriteria}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg shrink-0 font-medium transition-all"
                        style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--border-hover)' }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Add defaults
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="glass rounded-xl p-4 space-y-2">
                      <Input value={newCritName} onChange={setNewCritName} placeholder="Criterion name — e.g. Clarity, Technical Depth" />
                      <Textarea value={newCritDesc} onChange={setNewCritDesc} rows={2}
                        placeholder="Scoring guide for the AI — the more specific, the better. e.g. Does the presenter clearly identify the problem and who has it? Do they show evidence rather than assertion?" />
                      <div className="flex items-end gap-2">
                        <div className="w-28">
                          <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Weight</label>
                          <Input value={newCritWeight} onChange={setNewCritWeight} placeholder="1.0" />
                        </div>
                        <Btn onClick={createCriteria} disabled={!newCritName.trim()}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                          Add
                        </Btn>
                      </div>
                    </div>

                    {criteria.map((c, i) => (
                      <div key={c.id} className="glass rounded-xl px-4 py-3 flex items-start gap-3">
                        <span className="text-xs w-5 text-center font-mono mt-0.5 shrink-0" style={{ color: 'var(--text-muted)' }}>{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{c.name}</p>
                            {c.weight !== 1 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                                style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--border-hover)' }}>
                                ×{c.weight}
                              </span>
                            )}
                          </div>
                          {c.description && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{c.description}</p>}
                        </div>
                        <DeleteBtn onClick={() => deleteCriteria(c.id)} />
                      </div>
                    ))}

                    {criteria.length === 0 && (
                      <p className="text-xs text-center py-3" style={{ color: 'var(--text-muted)' }}>No criteria yet — use "Add defaults" for a ready-made set</p>
                    )}
                  </div>
                </section>

                {/* ── Step 5: Theme ────────────────────────────────────── */}
                <section>
                  <SectionHeading step={5} title="Display Theme"
                    subtitle="Shown on the audience display screen." />
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
                          <div className="min-w-0">
                            <p className="text-sm font-medium" style={{ color: isSelected ? 'var(--accent)' : 'var(--text-secondary)' }}>
                              {theme.name}
                            </p>
                            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{theme.description}</p>
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
                </section>

                {/* ── Ready banner ─────────────────────────────────────── */}
                {teams.length > 0 && criteria.length > 0 && (
                  <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                    className="rounded-xl p-4 flex items-center justify-between gap-4"
                    style={{ background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.2)' }}>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: '#4ade80' }}>Ready to evaluate</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {teams.length} participant{teams.length !== 1 ? 's' : ''} · {criteria.length} criteri{criteria.length !== 1 ? 'a' : 'on'}
                      </p>
                    </div>
                    <Link href="/"
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                      style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>
                      Start evaluating
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </Link>
                  </motion.div>
                )}

              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Env vars reference (collapsible) ─────────────────────── */}
          <section>
            <button onClick={() => setShowEnvVars(v => !v)}
              className="flex items-center gap-2 text-xs w-full py-2"
              style={{ color: 'var(--text-muted)' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                style={{ transform: showEnvVars ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
              Environment variables reference
            </button>
            <AnimatePresence>
              {showEnvVars && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="glass rounded-xl overflow-hidden divide-y mt-1" style={{ borderColor: 'var(--border)' }}>
                    {[
                      { key: 'NEXT_PUBLIC_SUPABASE_URL', hint: 'Project Settings → API' },
                      { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', hint: 'Public key, safe for browser' },
                      { key: 'SUPABASE_SERVICE_ROLE_KEY', hint: 'Server-only, never in browser' },
                      { key: 'DEEPGRAM_API_KEY', hint: 'console.deepgram.com' },
                      { key: 'DEEPGRAM_PROJECT_ID', hint: 'Optional — enables temporary keys' },
                      { key: 'ANTHROPIC_API_KEY', hint: 'console.anthropic.com' },
                    ].map(({ key, hint }) => (
                      <div key={key} className="px-4 py-2.5 flex items-center justify-between gap-4">
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{hint}</p>
                        <code className="text-[10px] px-2 py-0.5 rounded shrink-0 font-mono"
                          style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                          {key}
                        </code>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

        </main>
      </div>
    </ThemeProvider>
  )
}
