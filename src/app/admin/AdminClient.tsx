'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase'
import { Session, Team, Criteria } from '@/lib/types'
import { ThemeProvider } from '@/components/ThemeSelector'
import { themes } from '@/lib/themes'
import { useAppStore } from '@/lib/store'

// ── Templates ────────────────────────────────────────────────────────────────

interface Template {
  id: string
  name: string
  icon: string
  tagline: string
  brief: string
  criteria: { name: string; description: string; weight: number }[]
}

const TEMPLATES: Template[] = [
  {
    id: 'hackathon',
    name: 'Hackathon Pitch',
    icon: '⚡',
    tagline: 'Score teams on innovation, execution, and clarity',
    brief: `This is a time-boxed hackathon. Teams present a working prototype that solves a real problem — we want to see the product working, not slides about what it might do. Ideas should be genuinely novel, not a thin wrapper on an existing tool. Technical ambition matters, but so does clarity: if you can't explain the problem and solution in 60 seconds, that's a gap. Presentations are 5 minutes followed by Q&A.`,
    criteria: [
      { name: 'Innovation', weight: 1.5, description: 'How original is the idea? Does it approach the problem in a genuinely novel way, or is it incremental? Look for unexpected angles and ideas that challenge assumptions. Penalise obvious extensions of existing products.' },
      { name: 'Technical Execution', weight: 1.5, description: 'Is there a working prototype? Does it actually function, or is it held together with string? Real working code beats mocked demos. Consider complexity relative to the time available.' },
      { name: 'Problem Clarity', weight: 1, description: 'Has the team clearly defined the problem and who has it? Do they have evidence the problem is real? Vague or assumed problems should score lower even if the solution is impressive.' },
      { name: 'Impact Potential', weight: 1, description: 'If this succeeded at scale, how much would it matter? Consider problem size, realism of reach, and whether the team has thought about what success actually looks like.' },
      { name: 'Presentation', weight: 0.5, description: 'Is the pitch clear, confident, and well-structured? Does the team get to the point quickly and make the demo easy to follow? Penalise pitches that spend too long on background.' },
    ],
  },
  {
    id: 'interview',
    name: 'Job Interview',
    icon: '🎯',
    tagline: 'Evaluate candidates against role competencies',
    brief: `This is a structured interview. We're evaluating candidates against specific competencies for the role. Listen for concrete examples (STAR format: Situation, Task, Action, Result) rather than abstract claims about skills. Strong candidates show self-awareness, speak about failure honestly, and adapt their communication style to the audience. Generic answers without specifics should score lower even if they sound polished.`,
    criteria: [
      { name: 'Relevant Experience', weight: 1.5, description: 'Have they done genuinely similar work before? Do they give specific, concrete examples rather than speaking in generalities? Vague claims about "leading teams" or "driving impact" without substance score low.' },
      { name: 'Problem Solving', weight: 1.5, description: 'Does the candidate break down complex problems clearly? Do they show their thinking process, not just the conclusion? Look for structured reasoning and ability to handle ambiguity.' },
      { name: 'Communication', weight: 1, description: 'Are they clear and concise? Do they adapt their explanation to the audience? Can they explain complex things simply without losing nuance? Penalise jargon-heavy answers.' },
      { name: 'Self-Awareness', weight: 1, description: "Do they acknowledge mistakes, growth areas, or things they'd do differently? Are they honest about the limits of their experience? Over-confidence with no acknowledgement of failure is a red flag." },
      { name: 'Team & Culture Fit', weight: 0.5, description: 'How do they talk about collaboration, disagreement, and working with difficult people? Do they show respect for different perspectives? Look for humility alongside confidence.' },
    ],
  },
]

const WEIGHT_OPTIONS = [
  { label: 'Standard ×1', value: 1 },
  { label: 'High ×1.5', value: 1.5 },
  { label: 'Critical ×2', value: 2 },
]

const BRIEF_PLACEHOLDER = `Describe what you're evaluating and what good looks like. The more specific, the more accurately the AI scores.\n\ne.g. "This is a 5-minute investor pitch. We want to see a clear problem, evidence of market size, and a differentiated solution. Teams should demonstrate traction or a working prototype."`

// ── Primitives ──────────────────────────────────────────────────────────────

function Input({ value, onChange, placeholder, className = '', onEnter, autoFocus }: {
  value: string; onChange: (v: string) => void; placeholder?: string
  className?: string; onEnter?: () => void; autoFocus?: boolean
}) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      onKeyDown={e => { if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter() } }}
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
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3 py-2 rounded-lg text-sm placeholder:text-[color:var(--text-muted)] focus:outline-none transition-colors resize-none"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
      onFocus={e => { e.currentTarget.style.borderColor = 'var(--border-hover)' }}
      onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
    />
  )
}

function WeightSelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(parseFloat(e.target.value))}
      className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none transition-colors"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-primary)', appearance: 'none' }}
      onFocus={e => { e.currentTarget.style.borderColor = 'var(--border-hover)' }}
      onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
    >
      {WEIGHT_OPTIONS.map(o => (
        <option key={o.value} value={o.value} style={{ background: '#0f0f1a' }}>{o.label}</option>
      ))}
    </select>
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

// ── Main ────────────────────────────────────────────────────────────────────

export default function AdminClient() {
  const { setThemeId } = useAppStore()
  const supabase = createClient()

  const [dbError, setDbError] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const [showAllSessions, setShowAllSessions] = useState(false)
  const [editingSessionName, setEditingSessionName] = useState(false)
  const [sessionNameDraft, setSessionNameDraft] = useState('')

  const [newSessionName, setNewSessionName] = useState('')
  const [brief, setBrief] = useState('')
  const [briefStatus, setBriefStatus] = useState<'saved' | 'unsaved' | 'saving'>('saved')
  const savedBriefRef = useRef('')

  const [teams, setTeams] = useState<Team[]>([])
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamDesc, setNewTeamDesc] = useState('')
  const [editingTeam, setEditingTeam] = useState<{ id: string; name: string; description: string } | null>(null)

  const [criteria, setCriteria] = useState<Criteria[]>([])
  const [newCritName, setNewCritName] = useState('')
  const [newCritDesc, setNewCritDesc] = useState('')
  const [newCritWeight, setNewCritWeight] = useState(1)
  const [editingCriteria, setEditingCriteria] = useState<{ id: string; name: string; description: string; weight: number } | null>(null)

  const [appliedTemplate, setAppliedTemplate] = useState<string | null>(null)
  const [confirmReplaceTemplate, setConfirmReplaceTemplate] = useState<Template | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'team' | 'criteria' | 'session'; id: string } | null>(null)
  const [showEnvVars, setShowEnvVars] = useState(false)
  const [detectionMode, setDetectionMode] = useState<'manual' | 'automatic'>('manual')

  // ── API key management ─────────────────────────────────────────────────────
  type ApiKeySetting = { key: string; label: string; hint: string; isSet: boolean; source: string; preview: string; updatedAt: string | null }
  const [apiKeySettings, setApiKeySettings] = useState<ApiKeySetting[]>([])
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [keyDraft, setKeyDraft] = useState('')
  const [keySaving, setKeySaving] = useState(false)

  // ── Auto-save brief ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeSession) return
    if (brief === savedBriefRef.current) { setBriefStatus('saved'); return }
    setBriefStatus('unsaved')
    const t = setTimeout(async () => {
      setBriefStatus('saving')
      await supabase.from('sessions').update({ brief: brief.trim() || null }).eq('id', activeSession.id)
      setActiveSession(p => p ? { ...p, brief: brief.trim() || null } : null)
      savedBriefRef.current = brief
      setBriefStatus('saved')
    }, 1200)
    return () => clearTimeout(t)
  }, [brief, activeSession?.id])

  const loadApiKeys = async () => {
    const res = await fetch('/api/settings')
    if (res.ok) {
      const data = await res.json()
      setApiKeySettings(data.settings)
    }
  }

  // ── Load ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadApiKeys()

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
        const active = data.find(s => s.is_active)
        if (active) { setActiveSession(active); setBrief(active.brief || ''); savedBriefRef.current = active.brief || ''; setDetectionMode(active.detection_mode || 'manual') }
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
      setSessions(p => p.map(s => ({ ...s, is_active: s.id === sess.id })))
      setActiveSession(data)
      setBrief(data.brief || '')
      savedBriefRef.current = data.brief || ''
      setBriefStatus('saved')
      setThemeId(data.theme_id || 'midnight')
      setDetectionMode(data.detection_mode || 'manual')
      setTeams([]); setCriteria([])
      setAppliedTemplate(null)
    }
  }

  const createSession = async () => {
    if (!newSessionName.trim()) return
    if (activeSession) await supabase.from('sessions').update({ is_active: false }).eq('id', activeSession.id)
    const { data, error } = await supabase.from('sessions').insert({ name: newSessionName.trim(), is_active: true }).select().single()
    if (error) { setDbError(`Create failed: ${error.message}`); return }
    if (data) {
      setSessions(p => [data, ...p.map(s => ({ ...s, is_active: false }))])
      setActiveSession(data); setBrief(''); savedBriefRef.current = ''; setBriefStatus('saved')
      setTeams([]); setCriteria([]); setNewSessionName(''); setDbError(null); setAppliedTemplate(null)
    }
  }

  const saveSessionName = async () => {
    if (!activeSession || !sessionNameDraft.trim()) return
    const name = sessionNameDraft.trim()
    await supabase.from('sessions').update({ name }).eq('id', activeSession.id)
    setActiveSession(p => p ? { ...p, name } : null)
    setSessions(p => p.map(s => s.id === activeSession.id ? { ...s, name } : s))
    setEditingSessionName(false)
  }

  const deleteSession = async (id: string) => {
    await supabase.from('sessions').delete().eq('id', id)
    setSessions(p => p.filter(s => s.id !== id))
    if (activeSession?.id === id) { setActiveSession(null); setBrief(''); savedBriefRef.current = ''; setTeams([]); setCriteria([]) }
    setConfirmDelete(null)
  }

  const setSessionTheme = async (themeId: string) => {
    if (!activeSession) return
    await supabase.from('sessions').update({ theme_id: themeId }).eq('id', activeSession.id)
    setActiveSession(p => p ? { ...p, theme_id: themeId as any } : null)
    setThemeId(themeId as any)
  }

  const saveApiKey = async (key: string) => {
    if (!keyDraft.trim()) return
    setKeySaving(true)
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value: keyDraft.trim() }),
    })
    setKeySaving(false)
    setEditingKey(null)
    setKeyDraft('')
    await loadApiKeys()
  }

  const removeApiKey = async (key: string) => {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value: '' }),
    })
    setEditingKey(null)
    await loadApiKeys()
  }

  const saveDetectionMode = async (mode: 'manual' | 'automatic') => {
    if (!activeSession) return
    setDetectionMode(mode)
    await supabase.from('sessions').update({ detection_mode: mode }).eq('id', activeSession.id)
    setActiveSession(p => p ? { ...p, detection_mode: mode } : null)
  }

  // ── Teams ─────────────────────────────────────────────────────────────────

  const createTeam = async () => {
    if (!newTeamName.trim() || !activeSession) return
    const { data } = await supabase.from('teams').insert({
      session_id: activeSession.id, name: newTeamName.trim(),
      description: newTeamDesc.trim() || null, order_index: teams.length,
    }).select().single()
    if (data) { setTeams(p => [...p, data]); setNewTeamName(''); setNewTeamDesc('') }
  }

  const saveTeamEdit = async () => {
    if (!editingTeam || !editingTeam.name.trim()) return
    const { id, name, description } = editingTeam
    await supabase.from('teams').update({ name: name.trim(), description: description.trim() || null }).eq('id', id)
    setTeams(p => p.map(t => t.id === id ? { ...t, name: name.trim(), description: description.trim() || null } : t))
    setEditingTeam(null)
  }

  const deleteTeam = async (id: string) => {
    await supabase.from('teams').delete().eq('id', id)
    setTeams(p => p.filter(t => t.id !== id))
    setConfirmDelete(null)
  }

  const moveTeam = async (index: number, dir: 'up' | 'down') => {
    const swap = dir === 'up' ? index - 1 : index + 1
    if (swap < 0 || swap >= teams.length) return
    const next = [...teams]
    ;[next[index], next[swap]] = [next[swap], next[index]]
    setTeams(next)
    await Promise.all([
      supabase.from('teams').update({ order_index: index }).eq('id', next[index].id),
      supabase.from('teams').update({ order_index: swap }).eq('id', next[swap].id),
    ])
  }

  // ── Criteria ──────────────────────────────────────────────────────────────

  const createCriteria = async () => {
    if (!newCritName.trim() || !activeSession) return
    const { data } = await supabase.from('criteria').insert({
      session_id: activeSession.id, name: newCritName.trim(),
      description: newCritDesc.trim() || null,
      weight: newCritWeight,
      order_index: criteria.length,
    }).select().single()
    if (data) { setCriteria(p => [...p, data]); setNewCritName(''); setNewCritDesc(''); setNewCritWeight(1) }
  }

  const saveCriteriaEdit = async () => {
    if (!editingCriteria || !editingCriteria.name.trim()) return
    const { id, name, description, weight } = editingCriteria
    await supabase.from('criteria').update({ name: name.trim(), description: description.trim() || null, weight }).eq('id', id)
    setCriteria(p => p.map(c => c.id === id ? { ...c, name: name.trim(), description: description.trim() || null, weight } : c))
    setEditingCriteria(null)
  }

  const deleteCriteria = async (id: string) => {
    await supabase.from('criteria').delete().eq('id', id)
    setCriteria(p => p.filter(c => c.id !== id))
    setConfirmDelete(null)
  }

  const moveCriteria = async (index: number, dir: 'up' | 'down') => {
    const swap = dir === 'up' ? index - 1 : index + 1
    if (swap < 0 || swap >= criteria.length) return
    const next = [...criteria]
    ;[next[index], next[swap]] = [next[swap], next[index]]
    setCriteria(next)
    await Promise.all([
      supabase.from('criteria').update({ order_index: index }).eq('id', next[index].id),
      supabase.from('criteria').update({ order_index: swap }).eq('id', next[swap].id),
    ])
  }

  const applyTemplate = async (template: Template) => {
    if (!activeSession) return
    setBrief(template.brief)
    savedBriefRef.current = template.brief
    setBriefStatus('saved')
    await supabase.from('sessions').update({ brief: template.brief }).eq('id', activeSession.id)
    setActiveSession(p => p ? { ...p, brief: template.brief } : null)
    if (criteria.length > 0) await supabase.from('criteria').delete().eq('session_id', activeSession.id)
    setCriteria([])
    const rows = template.criteria.map((c, i) => ({
      session_id: activeSession.id, name: c.name, description: c.description, weight: c.weight, order_index: i,
    }))
    const { data } = await supabase.from('criteria').insert(rows).select()
    if (data) setCriteria(data)
    setAppliedTemplate(template.id)
    setConfirmReplaceTemplate(null)
  }

  const handleTemplateClick = (t: Template) => {
    if (criteria.length > 0) { setConfirmReplaceTemplate(t); return }
    applyTemplate(t)
  }

  const inactiveSessions = sessions.filter(s => !s.is_active)

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <ThemeProvider>
      <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>

        <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
          <div className="absolute -top-40 -left-40 w-80 h-80 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 65%)' }} />
        </div>

        <header className="relative z-10 flex items-center justify-between px-6 h-14 sticky top-0"
          style={{ borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)' }}>
          <div className="flex items-center gap-3">
            <Link href="/" className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}
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
          <div className="flex items-center gap-3">
            {activeSession && (
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#4ade80' }} />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{activeSession.name}</span>
              </div>
            )}
            <button
              onClick={async () => { const { createClient } = await import('@/lib/supabase'); await createClient().auth.signOut(); window.location.href = '/login' }}
              className="text-xs px-2.5 py-1.5 rounded-md transition-colors"
              style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hover)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}>
              Sign out
            </button>
          </div>
        </header>

        <main className="relative z-10 max-w-xl mx-auto px-6 py-8 space-y-8">

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

              <div className="glass rounded-xl p-4">
                <div className="flex gap-2">
                  <Input value={newSessionName} onChange={setNewSessionName}
                    placeholder="Session name — e.g. HackDay 2025"
                    className="flex-1" onEnter={createSession} />
                  <Btn onClick={createSession} disabled={!newSessionName.trim()}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Create
                  </Btn>
                </div>
              </div>

              {activeSession && (
                <div className="glass rounded-xl px-4 py-3 flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: '#4ade80' }} />
                  {editingSessionName ? (
                    <div className="flex-1 flex gap-2">
                      <Input value={sessionNameDraft} onChange={setSessionNameDraft} autoFocus
                        className="flex-1" onEnter={saveSessionName} />
                      <Btn onClick={saveSessionName} small>Save</Btn>
                      <Btn onClick={() => setEditingSessionName(false)} variant="ghost" small>Cancel</Btn>
                    </div>
                  ) : (
                    <>
                      <button className="text-sm font-medium flex-1 text-left hover:underline underline-offset-2"
                        onClick={() => { setSessionNameDraft(activeSession.name); setEditingSessionName(true) }}>
                        {activeSession.name}
                      </button>
                      <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)' }}>
                        Active
                      </span>
                      <InlineDeleteBtn
                        isConfirming={confirmDelete?.id === activeSession.id && confirmDelete.type === 'session'}
                        onRequest={() => setConfirmDelete({ type: 'session', id: activeSession.id })}
                        onConfirm={() => deleteSession(activeSession.id)}
                        onCancel={() => setConfirmDelete(null)}
                      />
                    </>
                  )}
                </div>
              )}

              {inactiveSessions.length > 0 && (
                <div>
                  <button onClick={() => setShowAllSessions(v => !v)}
                    className="flex items-center gap-1.5 text-xs py-1" style={{ color: 'var(--text-muted)' }}>
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
                        {inactiveSessions.map(sess => (
                          <div key={sess.id} className="glass rounded-xl px-4 py-2.5 flex items-center gap-3">
                            <span className="text-sm flex-1 truncate" style={{ color: 'var(--text-muted)' }}>{sess.name}</span>
                            <Btn onClick={() => activateSession(sess)} variant="ghost" small>Activate</Btn>
                            <InlineDeleteBtn
                              isConfirming={confirmDelete?.id === sess.id && confirmDelete.type === 'session'}
                              onRequest={() => setConfirmDelete({ type: 'session', id: sess.id })}
                              onConfirm={() => deleteSession(sess.id)}
                              onCancel={() => setConfirmDelete(null)}
                            />
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </section>

          <AnimatePresence>
            {activeSession && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8">

                {/* ── Quick-start templates ─────────────────────────────── */}
                <section>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>
                      Quick start
                    </span>
                    <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>or set up manually below</span>
                  </div>

                  {appliedTemplate ? (
                    <div className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.2)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span className="text-xs flex-1" style={{ color: '#4ade80' }}>
                        {TEMPLATES.find(t => t.id === appliedTemplate)?.name} template applied
                      </span>
                      <button onClick={() => setAppliedTemplate(null)}
                        className="text-xs underline underline-offset-2" style={{ color: 'var(--text-muted)' }}>
                        Switch template
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {TEMPLATES.map(t => (
                        <button key={t.id} onClick={() => handleTemplateClick(t)}
                          className="text-left p-4 rounded-xl transition-all"
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hover)'; (e.currentTarget as HTMLElement).style.background = 'var(--accent-dim)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)' }}>
                          <div className="text-2xl mb-2">{t.icon}</div>
                          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{t.name}</p>
                          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{t.tagline}</p>
                          <p className="text-xs mt-2 font-medium" style={{ color: 'var(--accent)' }}>
                            {t.criteria.length} criteria pre-loaded →
                          </p>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Replace criteria confirmation */}
                  <AnimatePresence>
                    {confirmReplaceTemplate && (
                      <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="mt-3 p-3 rounded-xl flex items-center gap-3"
                        style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2">
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                          <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        <span className="text-xs flex-1" style={{ color: '#fbbf24' }}>
                          This will replace {criteria.length} existing criteria. Continue?
                        </span>
                        <button onClick={() => applyTemplate(confirmReplaceTemplate)}
                          className="text-xs px-2.5 py-1 rounded-lg font-medium"
                          style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
                          Replace
                        </button>
                        <button onClick={() => setConfirmReplaceTemplate(null)}
                          className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Cancel
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>

                {/* ── Step 2: Context ──────────────────────────────────── */}
                <section>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <SectionHeading step={2} title="Context"
                      subtitle="What are you evaluating, and what does success look like? The AI uses this to score more accurately." />
                    <BriefStatusBadge status={briefStatus} />
                  </div>
                  <div className="glass rounded-xl p-4">
                    <Textarea value={brief} onChange={setBrief} rows={5} placeholder={BRIEF_PLACEHOLDER} />
                  </div>
                </section>

                {/* ── Step 3: Detection Mode ───────────────────────────── */}
                <section>
                  <SectionHeading step={3} title="Detection Mode"
                    subtitle="How should the app know when the next presenter has stepped up?" />
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    {([
                      { value: 'manual', label: 'Manual', icon: '🎯', desc: 'You select each participant in the app before recording starts.' },
                      { value: 'automatic', label: 'Automatic', icon: '🤖', desc: 'AI listens for applause, closing remarks, and new introductions to switch presenter automatically.' },
                    ] as const).map(({ value, label, icon, desc }) => {
                      const isSelected = detectionMode === value
                      return (
                        <button key={value} onClick={() => saveDetectionMode(value)}
                          className="text-left p-4 rounded-xl transition-all"
                          style={{
                            background: isSelected ? 'var(--accent-dim)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${isSelected ? 'var(--border-hover)' : 'var(--border)'}`,
                          }}>
                          <div className="text-2xl mb-2">{icon}</div>
                          <p className="text-sm font-semibold mb-1 flex items-center gap-2" style={{ color: isSelected ? 'var(--accent)' : 'var(--text-primary)' }}>
                            {label}
                            {isSelected && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </p>
                          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                        </button>
                      )
                    })}
                  </div>
                  {detectionMode === 'automatic' && (
                    <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-lg"
                      style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" className="mt-0.5 shrink-0">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <p className="text-xs" style={{ color: '#fbbf24' }}>
                        In automatic mode, participants are created on the fly — you don't need to add them below.
                        Scores are stored per participant and the display switches automatically.
                      </p>
                    </div>
                  )}
                </section>

                {/* ── Step 4: Participants ─────────────────────────────── */}
                <section>
                  <SectionHeading step={4} title={`Participants${teams.length ? ` (${teams.length})` : ''}`}
                    subtitle="Add each team, candidate, or presenter being evaluated." />
                  <div className="space-y-2">
                    <div className="glass rounded-xl p-4 space-y-2">
                      <div className="flex gap-2">
                        <Input value={newTeamName} onChange={setNewTeamName}
                          placeholder="Name — e.g. Team Alpha, Candidate A"
                          className="flex-1" onEnter={createTeam} />
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
                      <div key={team.id} className="glass rounded-xl overflow-hidden">
                        {editingTeam?.id === team.id ? (
                          <div className="p-4 space-y-2">
                            <Input value={editingTeam.name} onChange={v => setEditingTeam(p => p ? { ...p, name: v } : null)}
                              placeholder="Name" autoFocus onEnter={saveTeamEdit} />
                            <Input value={editingTeam.description}
                              onChange={v => setEditingTeam(p => p ? { ...p, description: v } : null)}
                              placeholder="Description (optional)" />
                            <div className="flex gap-2 justify-end pt-1">
                              <Btn onClick={() => setEditingTeam(null)} variant="ghost" small>Cancel</Btn>
                              <Btn onClick={saveTeamEdit} small disabled={!editingTeam.name.trim()}>Save</Btn>
                            </div>
                          </div>
                        ) : (
                          <div className="px-4 py-3 flex items-center gap-3">
                            <ReorderBtns onUp={() => moveTeam(i, 'up')} onDown={() => moveTeam(i, 'down')}
                              canUp={i > 0} canDown={i < teams.length - 1} />
                            <div className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => setEditingTeam({ id: team.id, name: team.name, description: team.description || '' })}>
                              <p className="text-sm font-medium hover:underline underline-offset-2">{team.name}</p>
                              {team.description && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{team.description}</p>}
                            </div>
                            <InlineDeleteBtn
                              isConfirming={confirmDelete?.id === team.id && confirmDelete.type === 'team'}
                              onRequest={() => setConfirmDelete({ type: 'team', id: team.id })}
                              onConfirm={() => deleteTeam(team.id)}
                              onCancel={() => setConfirmDelete(null)}
                            />
                          </div>
                        )}
                      </div>
                    ))}

                    {teams.length === 0 && (
                      <p className="text-xs text-center py-3" style={{ color: 'var(--text-muted)' }}>No participants yet</p>
                    )}
                  </div>
                </section>

                {/* ── Step 5: Criteria ─────────────────────────────────── */}
                <section>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-black"
                        style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--border-hover)' }}>
                        5
                      </div>
                      <div>
                        <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                          Scoring Criteria{criteria.length ? ` (${criteria.length})` : ''}
                        </h2>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          What the AI scores on. Specific descriptions lead to better, more reliable scores.
                        </p>
                      </div>
                    </div>
                    <button onClick={() => handleTemplateClick(TEMPLATES[0])}
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg shrink-0 font-medium transition-all"
                      style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--border-hover)' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      {criteria.length > 0 ? 'Use template' : 'Add defaults'}
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="glass rounded-xl p-4 space-y-2">
                      <Input value={newCritName} onChange={setNewCritName}
                        placeholder="Criterion name — e.g. Clarity, Technical Depth"
                        onEnter={createCriteria} />
                      <Textarea value={newCritDesc} onChange={setNewCritDesc} rows={2}
                        placeholder="Scoring guide — the more specific, the better. e.g. Does the presenter identify the problem with evidence, or just assert it?" />
                      <div className="flex items-center gap-2">
                        <div className="w-36">
                          <WeightSelect value={newCritWeight} onChange={setNewCritWeight} />
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
                      <div key={c.id} className="glass rounded-xl overflow-hidden">
                        {editingCriteria?.id === c.id ? (
                          <div className="p-4 space-y-2">
                            <Input value={editingCriteria.name}
                              onChange={v => setEditingCriteria(p => p ? { ...p, name: v } : null)}
                              placeholder="Name" autoFocus />
                            <Textarea value={editingCriteria.description}
                              onChange={v => setEditingCriteria(p => p ? { ...p, description: v } : null)}
                              rows={3} placeholder="Scoring guide" />
                            <div className="flex items-center gap-2">
                              <div className="w-36">
                                <WeightSelect value={editingCriteria.weight}
                                  onChange={v => setEditingCriteria(p => p ? { ...p, weight: v } : null)} />
                              </div>
                              <div className="flex-1" />
                              <Btn onClick={() => setEditingCriteria(null)} variant="ghost" small>Cancel</Btn>
                              <Btn onClick={saveCriteriaEdit} small disabled={!editingCriteria.name.trim()}>Save</Btn>
                            </div>
                          </div>
                        ) : (
                          <div className="px-4 py-3 flex items-start gap-3">
                            <ReorderBtns onUp={() => moveCriteria(i, 'up')} onDown={() => moveCriteria(i, 'down')}
                              canUp={i > 0} canDown={i < criteria.length - 1} />
                            <div className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => setEditingCriteria({ id: c.id, name: c.name, description: c.description || '', weight: c.weight })}>
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-medium hover:underline underline-offset-2">{c.name}</p>
                                {c.weight !== 1 && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0"
                                    style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--border-hover)' }}>
                                    ×{c.weight}
                                  </span>
                                )}
                              </div>
                              {c.description && (
                                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{c.description}</p>
                              )}
                            </div>
                            <InlineDeleteBtn
                              isConfirming={confirmDelete?.id === c.id && confirmDelete.type === 'criteria'}
                              onRequest={() => setConfirmDelete({ type: 'criteria', id: c.id })}
                              onConfirm={() => deleteCriteria(c.id)}
                              onCancel={() => setConfirmDelete(null)}
                            />
                          </div>
                        )}
                      </div>
                    ))}

                    {criteria.length === 0 && (
                      <p className="text-xs text-center py-3" style={{ color: 'var(--text-muted)' }}>
                        No criteria yet — use "Add defaults" for a ready-made set
                      </p>
                    )}
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
                        {briefStatus === 'unsaved' && <span style={{ color: '#fbbf24' }}> · context unsaved</span>}
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

                {/* ── Display Theme (secondary) ─────────────────────────── */}
                <section>
                  <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: 'var(--text-muted)' }}>
                    Display Theme
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {themes.map(theme => {
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

              </motion.div>
            )}
          </AnimatePresence>

          {/* ── API Keys ───────────────────────────────────────────────── */}
          <section>
            <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: 'var(--text-muted)' }}>
              API Keys
            </p>
            <div className="glass rounded-xl overflow-hidden divide-y" style={{ borderColor: 'var(--border)' }}>
              {apiKeySettings.length === 0 ? (
                <div className="px-4 py-3">
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading…</p>
                </div>
              ) : apiKeySettings.map((setting) => (
                <div key={setting.key}>
                  <div className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{setting.label}</p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                          style={{
                            background: setting.isSet ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)',
                            color: setting.isSet ? '#4ade80' : '#f87171',
                            border: `1px solid ${setting.isSet ? 'rgba(74,222,128,0.2)' : 'rgba(239,68,68,0.2)'}`,
                          }}>
                          {setting.isSet ? (setting.source === 'db' ? 'saved' : 'env') : 'not set'}
                        </span>
                      </div>
                      <p className="text-[10px] font-mono truncate" style={{ color: 'var(--text-muted)' }}>
                        {setting.isSet ? setting.preview : setting.hint}
                      </p>
                    </div>
                    <button
                      onClick={() => { setEditingKey(setting.key === editingKey ? null : setting.key); setKeyDraft('') }}
                      className="text-[11px] px-2.5 py-1 rounded-lg shrink-0 transition-all"
                      style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hover)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}>
                      {editingKey === setting.key ? 'Cancel' : setting.isSet ? 'Update' : 'Set'}
                    </button>
                  </div>
                  <AnimatePresence>
                    {editingKey === setting.key && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="px-4 pb-3 flex gap-2">
                          <input
                            type="password"
                            value={keyDraft}
                            onChange={e => setKeyDraft(e.target.value)}
                            placeholder={`Paste new ${setting.label}…`}
                            autoFocus
                            className="flex-1 text-xs px-3 py-2 rounded-lg font-mono"
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
                            onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
                            onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                            onKeyDown={async e => { if (e.key === 'Enter' && keyDraft.trim()) { await saveApiKey(setting.key) } }}
                          />
                          <button
                            onClick={() => saveApiKey(setting.key)}
                            disabled={keySaving || !keyDraft.trim()}
                            className="text-xs px-3 py-2 rounded-lg font-medium shrink-0"
                            style={{
                              background: keyDraft.trim() ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                              color: keyDraft.trim() ? 'white' : 'var(--text-muted)',
                              opacity: keySaving ? 0.6 : 1,
                            }}>
                            {keySaving ? 'Saving…' : 'Save'}
                          </button>
                          {setting.source === 'db' && (
                            <button
                              onClick={() => removeApiKey(setting.key)}
                              className="text-xs px-3 py-2 rounded-lg shrink-0"
                              style={{ color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                              Remove
                            </button>
                          )}
                        </div>
                        {setting.source === 'env' && (
                          <p className="px-4 pb-3 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            Currently using the env var. Saving here overrides it.
                          </p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </section>

          {/* ── Env vars reference ─────────────────────────────────────── */}
          <section>
            <button onClick={() => setShowEnvVars(v => !v)}
              className="flex items-center gap-2 text-xs w-full py-2" style={{ color: 'var(--text-muted)' }}>
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

          {/* ── Billing dashboards ─────────────────────────────────────── */}
          <section>
            <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: 'var(--text-muted)' }}>
              Billing
            </p>
            <div className="flex gap-2">
              {[
                { label: 'Anthropic Console', url: 'https://console.anthropic.com' },
                { label: 'Deepgram Console', url: 'https://console.deepgram.com' },
              ].map(({ label, url }) => (
                <a key={url} href={url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg transition-all"
                  style={{ color: 'var(--text-muted)', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hover)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  {label}
                </a>
              ))}
            </div>
          </section>

        </main>
      </div>
    </ThemeProvider>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function BriefStatusBadge({ status }: { status: 'saved' | 'unsaved' | 'saving' }) {
  if (status === 'saved') return null
  return (
    <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full mt-1"
      style={{
        background: status === 'saving' ? 'rgba(99,102,241,0.12)' : 'rgba(251,191,36,0.12)',
        color: status === 'saving' ? 'var(--accent)' : '#fbbf24',
        border: `1px solid ${status === 'saving' ? 'var(--border-hover)' : 'rgba(251,191,36,0.3)'}`,
      }}>
      {status === 'saving' ? 'Saving…' : 'Unsaved'}
    </span>
  )
}

function ReorderBtns({ onUp, onDown, canUp, canDown }: {
  onUp: () => void; onDown: () => void; canUp: boolean; canDown: boolean
}) {
  const btnStyle = (enabled: boolean) => ({
    color: enabled ? 'var(--text-muted)' : 'transparent',
    cursor: enabled ? 'pointer' : 'default',
  })
  return (
    <div className="flex flex-col gap-0.5 shrink-0 self-center">
      <button onClick={onUp} disabled={!canUp} className="p-0.5 rounded transition-colors hover:text-white"
        style={btnStyle(canUp)}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>
      <button onClick={onDown} disabled={!canDown} className="p-0.5 rounded transition-colors hover:text-white"
        style={btnStyle(canDown)}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
    </div>
  )
}

function InlineDeleteBtn({ isConfirming, onRequest, onConfirm, onCancel }: {
  isConfirming: boolean; onRequest: () => void; onConfirm: () => void; onCancel: () => void
}) {
  if (isConfirming) {
    return (
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Delete?</span>
        <button onClick={onConfirm}
          className="text-[10px] px-1.5 py-0.5 rounded font-medium"
          style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
          Yes
        </button>
        <button onClick={onCancel}
          className="text-[10px] px-1.5 py-0.5 rounded"
          style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
          No
        </button>
      </div>
    )
  }
  return (
    <button onClick={onRequest}
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
