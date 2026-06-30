'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase'
import { Session, Team, Criteria } from '@/lib/types'
import { ThemeProvider } from '@/components/ThemeSelector'
import { useAppStore } from '@/lib/store'

// ── Templates ────────────────────────────────────────────────────────────────

interface Template {
  id: string; name: string; icon: string; tagline: string; brief: string
  criteria: { name: string; description: string; weight: number }[]
}

const TEMPLATES: Template[] = [
  {
    id: 'hackathon', name: 'Hackathon Pitch', icon: '⚡',
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
    id: 'interview', name: 'Job Interview', icon: '🎯',
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

// ── Primitives ───────────────────────────────────────────────────────────────

function Input({ value, onChange, placeholder, className = '', onEnter, autoFocus, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string
  className?: string; onEnter?: () => void; autoFocus?: boolean; type?: string
}) {
  return (
    <input
      type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} autoFocus={autoFocus}
      onKeyDown={e => { if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter() } }}
      className={`w-full px-4 py-2.5 rounded-xl text-sm placeholder:text-[color:var(--text-muted)] focus:outline-none transition-colors ${className}`}
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
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
      value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} rows={rows}
      className="w-full px-4 py-3 rounded-xl text-sm placeholder:text-[color:var(--text-muted)] focus:outline-none transition-colors resize-none leading-relaxed"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
      onFocus={e => { e.currentTarget.style.borderColor = 'var(--border-hover)' }}
      onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
    />
  )
}

function WeightSelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <select value={value} onChange={e => onChange(parseFloat(e.target.value))}
      className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none transition-colors"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-primary)', appearance: 'none' }}
      onFocus={e => { e.currentTarget.style.borderColor = 'var(--border-hover)' }}
      onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}>
      {WEIGHT_OPTIONS.map(o => (
        <option key={o.value} value={o.value} style={{ background: '#0f0f1a' }}>{o.label}</option>
      ))}
    </select>
  )
}

function Btn({ onClick, children, variant = 'primary', disabled = false, size = 'md' }: {
  onClick: () => void; children: React.ReactNode; variant?: 'primary' | 'ghost' | 'danger'
  disabled?: boolean; size?: 'sm' | 'md' | 'lg'
}) {
  const styles = {
    primary: { background: 'var(--accent)', color: 'white', border: '1px solid transparent' },
    ghost: { background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: '1px solid var(--border)' },
    danger: { background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' },
  }
  const sizes = { sm: 'text-xs px-3 py-1.5', md: 'text-sm px-4 py-2', lg: 'text-sm px-5 py-2.5' }
  return (
    <button onClick={onClick} disabled={disabled}
      className={`flex items-center gap-2 rounded-xl font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap ${sizes[size]}`}
      style={styles[variant]}>
      {children}
    </button>
  )
}

function StepCard({ number, title, subtitle, children, action }: {
  number: number; title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
      <div className="flex items-center justify-between gap-4 px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0"
            style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--border-hover)' }}>
            {number}
          </span>
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
            {subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function AdminClient() {
  const { setThemeId } = useAppStore()
  const supabase = createClient()

  const [dbError, setDbError] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [viewedSession, setViewedSession] = useState<Session | null>(null)
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

  type ApiKeySetting = { key: string; label: string; hint: string; isSet: boolean; source: string; preview: string; updatedAt: string | null }
  const [apiKeySettings, setApiKeySettings] = useState<ApiKeySetting[]>([])
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [keyDraft, setKeyDraft] = useState('')
  const [keySaving, setKeySaving] = useState(false)

  // ── Auto-save brief ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!viewedSession) return
    if (brief === savedBriefRef.current) { setBriefStatus('saved'); return }
    setBriefStatus('unsaved')
    const t = setTimeout(async () => {
      setBriefStatus('saving')
      await supabase.from('sessions').update({ brief: brief.trim() || null }).eq('id', viewedSession.id)
      setViewedSession(p => p ? { ...p, brief: brief.trim() || null } : null)
      setSessions(p => p.map(s => s.id === viewedSession.id ? { ...s, brief: brief.trim() || null } : s))
      savedBriefRef.current = brief
      setBriefStatus('saved')
    }, 1200)
    return () => clearTimeout(t)
  }, [brief, viewedSession?.id])

  const loadApiKeys = async () => {
    const res = await fetch('/api/settings')
    if (res.ok) { const d = await res.json(); setApiKeySettings(d.settings) }
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
        const toView = data.find(s => s.is_active) ?? data[0] ?? null
        if (toView) {
          setViewedSession(toView)
          setBrief(toView.brief || '')
          savedBriefRef.current = toView.brief || ''
          setDetectionMode(toView.detection_mode || 'manual')
          if (toView.is_active) setThemeId(toView.theme_id || 'midnight')
        }
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (!viewedSession) return
    setTeams([]); setCriteria([]); setAppliedTemplate(null)
    Promise.all([
      supabase.from('teams').select('*').eq('session_id', viewedSession.id).order('order_index'),
      supabase.from('criteria').select('*').eq('session_id', viewedSession.id).order('order_index'),
    ]).then(([{ data: t }, { data: c }]) => {
      if (t) setTeams(t)
      if (c) {
        setCriteria(c)
        // Detect if criteria match a template by comparing criterion names
        const names = c.map((x: Criteria) => x.name)
        const match = TEMPLATES.find(tmpl =>
          tmpl.criteria.length === names.length &&
          tmpl.criteria.every((tc, i) => tc.name === names[i])
        )
        if (match) setAppliedTemplate(match.id)
      }
    })
  }, [viewedSession?.id])

  // ── Event management ───────────────────────────────────────────────────────

  const selectEvent = (sess: Session) => {
    if (sess.id === viewedSession?.id) return
    setViewedSession(sess)
    setBrief(sess.brief || '')
    savedBriefRef.current = sess.brief || ''
    setBriefStatus('saved')
    setDetectionMode(sess.detection_mode || 'manual')
    setAppliedTemplate(null)
    setEditingSessionName(false)
    setEditingTeam(null)
    setEditingCriteria(null)
  }

  const activateSession = async (sess: Session) => {
    await supabase.from('sessions').update({ is_active: false }).neq('id', sess.id)
    const { data } = await supabase.from('sessions').update({ is_active: true }).eq('id', sess.id).select().single()
    if (data) {
      setSessions(p => p.map(s => ({ ...s, is_active: s.id === sess.id })))
      setViewedSession(data)
      setBrief(data.brief || '')
      savedBriefRef.current = data.brief || ''
      setBriefStatus('saved')
      setThemeId(data.theme_id || 'midnight')
      setDetectionMode(data.detection_mode || 'manual')
    }
  }

  const deactivateSession = async (sess: Session) => {
    await supabase.from('sessions').update({ is_active: false }).eq('id', sess.id)
    setSessions(p => p.map(s => s.id === sess.id ? { ...s, is_active: false } : s))
    setViewedSession(p => p?.id === sess.id ? { ...p, is_active: false } : p)
  }

  const createSession = async () => {
    if (!newSessionName.trim()) return
    const { data, error } = await supabase.from('sessions').insert({ name: newSessionName.trim(), is_active: false }).select().single()
    if (error) { setDbError(`Create failed: ${error.message}`); return }
    if (data) { setSessions(p => [data, ...p]); selectEvent(data); setNewSessionName(''); setDbError(null) }
  }

  const saveSessionName = async () => {
    if (!viewedSession || !sessionNameDraft.trim()) return
    const name = sessionNameDraft.trim()
    await supabase.from('sessions').update({ name }).eq('id', viewedSession.id)
    setViewedSession(p => p ? { ...p, name } : null)
    setSessions(p => p.map(s => s.id === viewedSession.id ? { ...s, name } : s))
    setEditingSessionName(false)
  }

  const deleteSession = async (id: string) => {
    await supabase.from('sessions').delete().eq('id', id)
    const remaining = sessions.filter(s => s.id !== id)
    setSessions(remaining)
    if (viewedSession?.id === id) {
      const next = remaining[0] ?? null
      if (next) { selectEvent(next) } else { setViewedSession(null); setBrief(''); savedBriefRef.current = ''; setTeams([]); setCriteria([]) }
    }
    setConfirmDelete(null)
  }

  const saveDetectionMode = async (mode: 'manual' | 'automatic') => {
    if (!viewedSession) return
    setDetectionMode(mode)
    await supabase.from('sessions').update({ detection_mode: mode }).eq('id', viewedSession.id)
    setViewedSession(p => p ? { ...p, detection_mode: mode } : null)
    setSessions(p => p.map(s => s.id === viewedSession.id ? { ...s, detection_mode: mode } : s))
  }

  // ── Teams ──────────────────────────────────────────────────────────────────

  const createTeam = async () => {
    if (!newTeamName.trim() || !viewedSession) return
    const { data } = await supabase.from('teams').insert({
      session_id: viewedSession.id, name: newTeamName.trim(),
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

  // ── Criteria ───────────────────────────────────────────────────────────────

  const createCriteria = async () => {
    if (!newCritName.trim() || !viewedSession) return
    const { data } = await supabase.from('criteria').insert({
      session_id: viewedSession.id, name: newCritName.trim(),
      description: newCritDesc.trim() || null, weight: newCritWeight, order_index: criteria.length,
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
    if (!viewedSession) return
    setBrief(template.brief); savedBriefRef.current = template.brief; setBriefStatus('saved')
    await supabase.from('sessions').update({ brief: template.brief }).eq('id', viewedSession.id)
    setViewedSession(p => p ? { ...p, brief: template.brief } : null)
    if (criteria.length > 0) await supabase.from('criteria').delete().eq('session_id', viewedSession.id)
    setCriteria([])
    const rows = template.criteria.map((c, i) => ({
      session_id: viewedSession.id, name: c.name, description: c.description, weight: c.weight, order_index: i,
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

  const saveApiKey = async (key: string) => {
    if (!keyDraft.trim()) return
    setKeySaving(true)
    await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, value: keyDraft.trim() }) })
    setKeySaving(false); setEditingKey(null); setKeyDraft(''); await loadApiKeys()
  }

  const removeApiKey = async (key: string) => {
    await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, value: '' }) })
    setEditingKey(null); await loadApiKeys()
  }

  const liveSession = sessions.find(s => s.is_active) ?? null

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <ThemeProvider>
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>

        {/* ── Top bar ─────────────────────────────────────────────────── */}
        <header className="shrink-0 flex items-center justify-between px-6 h-14 sticky top-0 z-20"
          style={{ borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)' }}>
          <div className="flex items-center gap-3">
            <Link href="/" className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </Link>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--gradient-from), var(--gradient-to))' }}>
              <span className="text-[10px] font-black text-white">AJ</span>
            </div>
            <span className="font-bold gradient-text">AudioJudge</span>
            <span style={{ color: 'var(--border-hover)' }}>·</span>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Setup</span>
          </div>
          <div className="flex items-center gap-4">
            {liveSession && (
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: '#4ade80' }} />
                <span className="text-sm font-medium" style={{ color: '#4ade80' }}>{liveSession.name} · Live</span>
              </div>
            )}
            <button
              onClick={async () => { const { createClient } = await import('@/lib/supabase'); await createClient().auth.signOut(); window.location.href = '/login' }}
              className="text-sm px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hover)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}>
              Sign out
            </button>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">

          {/* ── Sidebar ───────────────────────────────────────────────── */}
          <aside className="w-72 shrink-0 flex flex-col overflow-y-auto"
            style={{ borderRight: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)', height: 'calc(100vh - 56px)', position: 'sticky', top: '56px' }}>

            {/* Events section */}
            <div className="p-4 space-y-2">
              <p className="text-xs font-bold tracking-widest uppercase px-1 mb-3" style={{ color: 'var(--text-muted)' }}>Events</p>

              {/* Create new */}
              <div className="flex gap-2">
                <input
                  value={newSessionName} onChange={e => setNewSessionName(e.target.value)}
                  placeholder="New event…"
                  onKeyDown={e => { if (e.key === 'Enter') createSession() }}
                  className="flex-1 px-3 py-2 rounded-lg text-sm placeholder:text-[color:var(--text-muted)] focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--border-hover)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                />
                <button onClick={createSession} disabled={!newSessionName.trim()}
                  className="px-3 py-2 rounded-lg text-sm font-medium shrink-0 disabled:opacity-40"
                  style={{ background: 'var(--accent)', color: 'white' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              </div>

              {dbError && (
                <div className="text-xs p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {dbError}
                </div>
              )}

              {/* Event list */}
              <div className="space-y-1 pt-1">
                {sessions.length === 0 && !dbError && (
                  <p className="text-xs px-1 py-2" style={{ color: 'var(--text-muted)' }}>No events yet</p>
                )}
                {sessions.map(sess => {
                  const isViewed = sess.id === viewedSession?.id
                  const isLive = sess.is_active
                  return (
                    <div key={sess.id}
                      className="group relative rounded-xl transition-all cursor-pointer"
                      style={{
                        background: isViewed ? 'var(--accent-dim)' : 'transparent',
                        border: `1px solid ${isViewed ? 'var(--border-hover)' : 'transparent'}`,
                      }}
                      onClick={() => selectEvent(sess)}>
                      <div className="flex items-center gap-2.5 px-3 py-2.5">
                        <span className="h-2 w-2 rounded-full shrink-0 mt-0.5"
                          style={{ background: isLive ? '#4ade80' : 'var(--border-hover)' }} />
                        <span className="text-sm font-medium flex-1 truncate"
                          style={{ color: isViewed ? 'var(--accent)' : 'var(--text-secondary)' }}>
                          {sess.name}
                        </span>
                        {isLive && (
                          <span className="text-[10px] font-bold tracking-wide shrink-0"
                            style={{ color: '#4ade80' }}>LIVE</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="flex-1" />

            {/* API key status */}
            {apiKeySettings.length > 0 && (
              <div className="px-4 pb-3" style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: 'var(--text-muted)' }}>API Keys</p>
                <div className="space-y-1">
                  {apiKeySettings.map(s => (
                    <div key={s.key} className="flex items-center gap-2 px-1 py-1">
                      <span className="h-1.5 w-1.5 rounded-full shrink-0"
                        style={{ background: s.isSet ? '#4ade80' : '#f87171' }} />
                      <span className="text-xs flex-1 truncate" style={{ color: 'var(--text-muted)' }}>{s.label}</span>
                      <span className="text-[10px]" style={{ color: s.isSet ? '#4ade80' : '#f87171' }}>
                        {s.isSet ? 'set' : 'missing'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>

          {/* ── Main content ──────────────────────────────────────────── */}
          <main className="flex-1 overflow-y-auto">
            {!viewedSession ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-3">
                  <div className="text-5xl">📋</div>
                  <p className="text-lg font-semibold" style={{ color: 'var(--text-secondary)' }}>No events yet</p>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Create an event in the sidebar to get started</p>
                </div>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto px-8 py-8 space-y-6">

                {/* Event header */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    {editingSessionName ? (
                      <div className="flex items-center gap-2">
                        <input
                          value={sessionNameDraft} onChange={e => setSessionNameDraft(e.target.value)}
                          autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') saveSessionName(); if (e.key === 'Escape') setEditingSessionName(false) }}
                          className="text-2xl font-bold bg-transparent border-b-2 focus:outline-none w-64"
                          style={{ color: 'var(--text-primary)', borderColor: 'var(--accent)' }}
                        />
                        <button onClick={saveSessionName} className="text-sm px-3 py-1 rounded-lg font-medium"
                          style={{ background: 'var(--accent)', color: 'white' }}>Save</button>
                        <button onClick={() => setEditingSessionName(false)} className="text-sm px-3 py-1 rounded-lg"
                          style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>Cancel</button>
                      </div>
                    ) : (
                      <button className="group flex items-center gap-2 text-left"
                        onClick={() => { setSessionNameDraft(viewedSession.name); setEditingSessionName(true) }}>
                        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{viewedSession.name}</h1>
                        <svg className="opacity-0 group-hover:opacity-50 transition-opacity" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 pt-1">
                    {viewedSession.is_active ? (
                      <>
                        <span className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-xl"
                          style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)' }}>
                          <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: '#4ade80' }} />
                          Live
                        </span>
                        <button onClick={() => deactivateSession(viewedSession)}
                          className="text-sm px-3 py-1.5 rounded-xl transition-colors"
                          style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f87171'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.4)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}>
                          Stop
                        </button>
                        <Link href="/" className="flex items-center gap-2 text-sm font-semibold px-4 py-1.5 rounded-xl"
                          style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>
                          Start evaluating
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </Link>
                      </>
                    ) : (
                      <button onClick={() => activateSession(viewedSession)}
                        className="flex items-center gap-2 text-sm font-semibold px-4 py-1.5 rounded-xl transition-all"
                        style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--border-hover)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent)'; (e.currentTarget as HTMLElement).style.color = 'white' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-dim)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}>
                        Set live
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" />
                        </svg>
                      </button>
                    )}
                    <InlineDeleteBtn
                      isConfirming={confirmDelete?.id === viewedSession.id && confirmDelete.type === 'session'}
                      onRequest={() => setConfirmDelete({ type: 'session', id: viewedSession.id })}
                      onConfirm={() => deleteSession(viewedSession.id)}
                      onCancel={() => setConfirmDelete(null)}
                    />
                  </div>
                </div>

                {/* Warning: editing non-live event */}
                {!viewedSession.is_active && liveSession && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
                    style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    You're editing <strong className="font-semibold mx-0.5">{viewedSession.name}</strong> — not live.
                    <strong className="font-semibold mx-0.5">{liveSession.name}</strong> is currently live.
                  </div>
                )}

                {/* ── Quick start ─────────────────────────────────────── */}
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <p className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>Quick start</p>
                    <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>or configure manually below</p>
                  </div>

                  {appliedTemplate ? (
                    <div className="flex items-center gap-3 p-4 rounded-xl"
                      style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span className="text-sm flex-1" style={{ color: '#4ade80' }}>
                        {TEMPLATES.find(t => t.id === appliedTemplate)?.name} template applied
                      </span>
                      <button onClick={() => setAppliedTemplate(null)} className="text-sm underline underline-offset-2"
                        style={{ color: 'var(--text-muted)' }}>
                        Switch
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      {TEMPLATES.map(t => (
                        <button key={t.id} onClick={() => handleTemplateClick(t)}
                          className="text-left p-5 rounded-xl transition-all"
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hover)'; (e.currentTarget as HTMLElement).style.background = 'var(--accent-dim)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)' }}>
                          <div className="text-3xl mb-3">{t.icon}</div>
                          <p className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{t.name}</p>
                          <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-muted)' }}>{t.tagline}</p>
                          <p className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
                            {t.criteria.length} criteria pre-loaded →
                          </p>
                        </button>
                      ))}
                    </div>
                  )}

                  <AnimatePresence>
                    {confirmReplaceTemplate && (
                      <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="mt-4 p-4 rounded-xl flex items-center gap-3"
                        style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2">
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                          <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        <span className="text-sm flex-1" style={{ color: '#fbbf24' }}>
                          This will replace {criteria.length} existing criteria. Continue?
                        </span>
                        <button onClick={() => applyTemplate(confirmReplaceTemplate)}
                          className="text-sm px-3 py-1.5 rounded-lg font-medium"
                          style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
                          Replace
                        </button>
                        <button onClick={() => setConfirmReplaceTemplate(null)} className="text-sm"
                          style={{ color: 'var(--text-muted)' }}>
                          Cancel
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* ── Step 1: Context ─────────────────────────────────── */}
                <StepCard
                  number={1}
                  title="Context"
                  subtitle="What are you evaluating and what does good look like? The more specific, the more accurate the AI scoring."
                  action={
                    briefStatus !== 'saved' ? (
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full"
                        style={{
                          background: briefStatus === 'saving' ? 'rgba(99,102,241,0.12)' : 'rgba(251,191,36,0.12)',
                          color: briefStatus === 'saving' ? 'var(--accent)' : '#fbbf24',
                          border: `1px solid ${briefStatus === 'saving' ? 'var(--border-hover)' : 'rgba(251,191,36,0.3)'}`,
                        }}>
                        {briefStatus === 'saving' ? 'Saving…' : 'Unsaved'}
                      </span>
                    ) : null
                  }>
                  <Textarea value={brief} onChange={setBrief} rows={6}
                    placeholder={`Describe what you're evaluating and what good looks like.\n\ne.g. "5-minute investor pitch. We want a clear problem, evidence of market size, and a working prototype. Strong teams will demonstrate real traction."`} />
                </StepCard>

                {/* ── Step 2: Detection Mode ───────────────────────────── */}
                <StepCard number={2} title="Detection Mode"
                  subtitle="How should the app know when the next presenter steps up?">
                  <div className="grid grid-cols-2 gap-4">
                    {([
                      { value: 'manual', label: 'Manual', icon: '🎯', desc: 'You tap to select each participant before recording starts.' },
                      { value: 'automatic', label: 'Automatic', icon: '🤖', desc: 'AI listens for applause and new introductions to switch presenter automatically.' },
                    ] as const).map(({ value, label, icon, desc }) => {
                      const isSelected = detectionMode === value
                      return (
                        <button key={value} onClick={() => saveDetectionMode(value)}
                          className="text-left p-5 rounded-xl transition-all"
                          style={{
                            background: isSelected ? 'var(--accent-dim)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                          }}>
                          <div className="text-3xl mb-3">{icon}</div>
                          <p className="text-base font-semibold mb-1 flex items-center gap-2"
                            style={{ color: isSelected ? 'var(--accent)' : 'var(--text-primary)' }}>
                            {label}
                            {isSelected && (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </p>
                          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                        </button>
                      )
                    })}
                  </div>
                  {detectionMode === 'automatic' && (
                    <div className="mt-4 flex items-start gap-3 px-4 py-3 rounded-xl"
                      style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" className="mt-0.5 shrink-0">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <p className="text-sm" style={{ color: '#fbbf24' }}>
                        Participants are created on the fly — no need to add them below.
                        Scores and summaries are stored per presenter automatically.
                      </p>
                    </div>
                  )}
                </StepCard>

                {/* ── Step 3: Participants ─────────────────────────────── */}
                {detectionMode === 'manual' && (
                  <StepCard number={3} title={`Participants${teams.length ? ` (${teams.length})` : ''}`}
                    subtitle="Add each team, candidate, or presenter being evaluated.">
                    <div className="space-y-3">
                      <div className="space-y-2 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                        <Input value={newTeamName} onChange={setNewTeamName}
                          placeholder="Name — e.g. Team Alpha, Candidate A" onEnter={createTeam} />
                        <Input value={newTeamDesc} onChange={setNewTeamDesc}
                          placeholder="Short description (optional)" />
                        <div className="flex justify-end pt-1">
                          <Btn onClick={createTeam} disabled={!newTeamName.trim()}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Add participant
                          </Btn>
                        </div>
                      </div>

                      {teams.map((team, i) => (
                        <div key={team.id} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                          {editingTeam?.id === team.id ? (
                            <div className="p-4 space-y-2">
                              <Input value={editingTeam.name} onChange={v => setEditingTeam(p => p ? { ...p, name: v } : null)}
                                placeholder="Name" autoFocus onEnter={saveTeamEdit} />
                              <Input value={editingTeam.description}
                                onChange={v => setEditingTeam(p => p ? { ...p, description: v } : null)}
                                placeholder="Description (optional)" />
                              <div className="flex gap-2 justify-end pt-1">
                                <Btn onClick={() => setEditingTeam(null)} variant="ghost" size="sm">Cancel</Btn>
                                <Btn onClick={saveTeamEdit} size="sm" disabled={!editingTeam.name.trim()}>Save</Btn>
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
                        <p className="text-sm text-center py-2" style={{ color: 'var(--text-muted)' }}>No participants yet</p>
                      )}
                    </div>
                  </StepCard>
                )}

                {/* ── Step 4: Criteria ─────────────────────────────────── */}
                <StepCard
                  number={detectionMode === 'manual' ? 4 : 3}
                  title={`Scoring Criteria${criteria.length ? ` (${criteria.length})` : ''}`}
                  subtitle="What the AI scores on. Specific descriptions produce much more reliable scores."
                  action={
                    <button onClick={() => handleTemplateClick(TEMPLATES[0])}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
                      style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--border-hover)' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      {criteria.length > 0 ? 'Use template' : 'Load defaults'}
                    </button>
                  }>
                  <div className="space-y-3">
                    <div className="space-y-2 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                      <Input value={newCritName} onChange={setNewCritName}
                        placeholder="Criterion name — e.g. Clarity, Technical Depth" onEnter={createCriteria} />
                      <Textarea value={newCritDesc} onChange={setNewCritDesc} rows={3}
                        placeholder="Scoring guide — the more specific the better. e.g. Does the presenter identify the problem with evidence, or just assert it exists?" />
                      <div className="flex items-center gap-3 pt-1">
                        <div className="w-44"><WeightSelect value={newCritWeight} onChange={setNewCritWeight} /></div>
                        <Btn onClick={createCriteria} disabled={!newCritName.trim()}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                          Add criterion
                        </Btn>
                      </div>
                    </div>

                    {criteria.map((c, i) => (
                      <div key={c.id} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                        {editingCriteria?.id === c.id ? (
                          <div className="p-4 space-y-2">
                            <Input value={editingCriteria.name}
                              onChange={v => setEditingCriteria(p => p ? { ...p, name: v } : null)}
                              placeholder="Name" autoFocus />
                            <Textarea value={editingCriteria.description}
                              onChange={v => setEditingCriteria(p => p ? { ...p, description: v } : null)}
                              rows={3} placeholder="Scoring guide" />
                            <div className="flex items-center gap-3">
                              <div className="w-44"><WeightSelect value={editingCriteria.weight}
                                onChange={v => setEditingCriteria(p => p ? { ...p, weight: v } : null)} /></div>
                              <div className="flex-1" />
                              <Btn onClick={() => setEditingCriteria(null)} variant="ghost" size="sm">Cancel</Btn>
                              <Btn onClick={saveCriteriaEdit} size="sm" disabled={!editingCriteria.name.trim()}>Save</Btn>
                            </div>
                          </div>
                        ) : (
                          <div className="px-4 py-3 flex items-start gap-3">
                            <ReorderBtns onUp={() => moveCriteria(i, 'up')} onDown={() => moveCriteria(i, 'down')}
                              canUp={i > 0} canDown={i < criteria.length - 1} />
                            <div className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => setEditingCriteria({ id: c.id, name: c.name, description: c.description || '', weight: c.weight })}>
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-semibold hover:underline underline-offset-2">{c.name}</p>
                                {c.weight !== 1 && (
                                  <span className="text-xs px-2 py-0.5 rounded font-mono"
                                    style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--border-hover)' }}>
                                    ×{c.weight}
                                  </span>
                                )}
                              </div>
                              {c.description && (
                                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{c.description}</p>
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
                      <p className="text-sm text-center py-2" style={{ color: 'var(--text-muted)' }}>
                        No criteria yet — use "Load defaults" for a ready-made set
                      </p>
                    )}
                  </div>
                </StepCard>

                {/* ── API Keys ─────────────────────────────────────────── */}
                <StepCard number={detectionMode === 'manual' ? 6 : 5} title="API Keys"
                  subtitle="Keys are stored per-user and never shared.">
                  <div className="space-y-2">
                    {apiKeySettings.length === 0 ? (
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</p>
                    ) : apiKeySettings.map((setting) => (
                      <div key={setting.key} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                        <div className="px-4 py-3 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{setting.label}</p>
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                style={{
                                  background: setting.isSet ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)',
                                  color: setting.isSet ? '#4ade80' : '#f87171',
                                  border: `1px solid ${setting.isSet ? 'rgba(74,222,128,0.2)' : 'rgba(239,68,68,0.2)'}`,
                                }}>
                                {setting.isSet ? 'saved' : 'not set'}
                              </span>
                            </div>
                            <p className="text-xs font-mono truncate" style={{ color: 'var(--text-muted)' }}>
                              {setting.isSet ? setting.preview : setting.hint}
                            </p>
                          </div>
                          <button
                            onClick={() => { setEditingKey(setting.key === editingKey ? null : setting.key); setKeyDraft('') }}
                            className="text-sm px-3 py-1.5 rounded-lg shrink-0 transition-all"
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
                              <div className="px-4 pb-4 flex gap-2" style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                                <input
                                  type="password" value={keyDraft} onChange={e => setKeyDraft(e.target.value)}
                                  placeholder={`Paste ${setting.label}…`} autoFocus
                                  className="flex-1 text-sm px-4 py-2.5 rounded-xl font-mono"
                                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
                                  onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
                                  onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                                  onKeyDown={async e => { if (e.key === 'Enter' && keyDraft.trim()) await saveApiKey(setting.key) }}
                                />
                                <button onClick={() => saveApiKey(setting.key)} disabled={keySaving || !keyDraft.trim()}
                                  className="text-sm px-4 py-2.5 rounded-xl font-medium shrink-0"
                                  style={{ background: keyDraft.trim() ? 'var(--accent)' : 'rgba(255,255,255,0.05)', color: keyDraft.trim() ? 'white' : 'var(--text-muted)', opacity: keySaving ? 0.6 : 1 }}>
                                  {keySaving ? 'Saving…' : 'Save'}
                                </button>
                                {setting.isSet && (
                                  <button onClick={() => removeApiKey(setting.key)}
                                    className="text-sm px-3 py-2.5 rounded-xl shrink-0"
                                    style={{ color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                                    Remove
                                  </button>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </div>
                </StepCard>

                {/* ── Env vars + Billing ───────────────────────────────── */}
                <div className="flex items-center gap-4 pb-8">
                  <div className="flex gap-2">
                    {[
                      { label: 'Anthropic Console', url: 'https://console.anthropic.com' },
                      { label: 'Deepgram Console', url: 'https://console.deepgram.com' },
                    ].map(({ label, url }) => (
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg transition-all"
                        style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hover)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                        {label}
                      </a>
                    ))}
                  </div>
                  <div className="flex-1" />
                  <button onClick={() => setShowEnvVars(v => !v)}
                    className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                      style={{ transform: showEnvVars ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    Env vars
                  </button>
                </div>

                <AnimatePresence>
                  {showEnvVars && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }} className="overflow-hidden -mt-4 pb-8">
                      <div className="rounded-xl overflow-hidden divide-y" style={{ border: '1px solid var(--border)', borderColor: 'var(--border)' }}>
                        {[
                          { key: 'NEXT_PUBLIC_SUPABASE_URL', hint: 'Project Settings → API' },
                          { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', hint: 'Public key, safe for browser' },
                          { key: 'SUPABASE_SERVICE_ROLE_KEY', hint: 'Server-only, never in browser' },
                          { key: 'DEEPGRAM_API_KEY', hint: 'console.deepgram.com' },
                          { key: 'DEEPGRAM_PROJECT_ID', hint: 'Optional — enables temporary keys' },
                          { key: 'ANTHROPIC_API_KEY', hint: 'console.anthropic.com' },
                        ].map(({ key, hint }) => (
                          <div key={key} className="px-4 py-3 flex items-center justify-between gap-4">
                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{hint}</p>
                            <code className="text-xs px-2 py-1 rounded font-mono shrink-0"
                              style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                              {key}
                            </code>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

              </div>
            )}
          </main>
        </div>
      </div>
    </ThemeProvider>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ReorderBtns({ onUp, onDown, canUp, canDown }: {
  onUp: () => void; onDown: () => void; canUp: boolean; canDown: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5 shrink-0 self-center">
      <button onClick={onUp} disabled={!canUp} className="p-0.5 rounded transition-colors hover:text-white disabled:opacity-0">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ color: canUp ? 'var(--text-muted)' : 'transparent' }}>
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>
      <button onClick={onDown} disabled={!canDown} className="p-0.5 rounded transition-colors hover:text-white disabled:opacity-0">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ color: canDown ? 'var(--text-muted)' : 'transparent' }}>
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
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Delete?</span>
        <button onClick={onConfirm} className="text-xs px-2 py-1 rounded-lg font-medium"
          style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
          Yes
        </button>
        <button onClick={onCancel} className="text-xs px-2 py-1 rounded-lg"
          style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
          No
        </button>
      </div>
    )
  }
  return (
    <button onClick={onRequest} className="p-1.5 rounded-lg transition-all shrink-0"
      style={{ color: 'var(--text-muted)' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ef4444'; (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
      </svg>
    </button>
  )
}
