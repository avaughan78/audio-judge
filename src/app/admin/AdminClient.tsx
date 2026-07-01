'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import { createClient } from '@/lib/supabase'
import { Session, Criteria } from '@/lib/types'
import { ThemeProvider } from '@/components/ThemeSelector'
import AppHeader from '@/components/AppHeader'
import { useAppStore } from '@/lib/store'

// ── Templates ────────────────────────────────────────────────────────────────

interface Template {
  id: string; name: string; icon: string; brief: string
  criteria: { name: string; description: string; weight: number }[]
}

const TEMPLATES: Template[] = [
  {
    id: 'hackathon', name: 'Hackathon Pitch', icon: '⚡',
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

const tabVariants = {
  enter: (dir: number) => ({ x: `${dir * 100}%`, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: `${-dir * 100}%`, opacity: 0 }),
}

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
      className={`w-full px-4 py-2.5 rounded-xl text-base placeholder:text-[color:var(--text-muted)] focus:outline-none transition-colors ${className}`}
      style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
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
      className="w-full px-4 py-3 rounded-xl text-base placeholder:text-[color:var(--text-muted)] focus:outline-none transition-colors resize-none leading-relaxed"
      style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
      onFocus={e => { e.currentTarget.style.borderColor = 'var(--border-hover)' }}
      onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
    />
  )
}

function WeightSelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <select value={value} onChange={e => onChange(parseFloat(e.target.value))}
      className="w-full px-4 py-2.5 rounded-xl text-base focus:outline-none transition-colors"
      style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)', appearance: 'none' }}
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
    ghost: { background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)' },
    danger: { background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' },
  }
  const sizes = { sm: 'text-base px-3 py-2', md: 'text-base px-4 py-2', lg: 'text-base px-5 py-2.5' }
  return (
    <button onClick={onClick} disabled={disabled}
      className={`flex items-center gap-2 rounded-xl font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap ${sizes[size]}`}
      style={styles[variant]}>
      {children}
    </button>
  )
}

// Flat section — label + spacing, no card wrapper
function Section({ title, subtitle, children, action }: {
  title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-base font-semibold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>{title}</p>
          {subtitle && <p className="mt-0.5 text-base" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function AdminClient() {
  const { setThemeId, themeId: currentThemeId } = useAppStore()
  const supabase = createClient()

  const [dbError, setDbError] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [viewedSession, setViewedSession] = useState<Session | null>(null)
  const [editingSessionName, setEditingSessionName] = useState(false)
  const [sessionNameDraft, setSessionNameDraft] = useState('')
  const [newSessionName, setNewSessionName] = useState('')

  const reorderTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [brief, setBrief] = useState('')
  const [briefStatus, setBriefStatus] = useState<'saved' | 'unsaved' | 'saving'>('saved')
  const savedBriefRef = useRef('')

  const [criteria, setCriteria] = useState<Criteria[]>([])
  const [newCritName, setNewCritName] = useState('')
  const [newCritDesc, setNewCritDesc] = useState('')
  const [newCritWeight, setNewCritWeight] = useState(1)
  const [editingCriteria, setEditingCriteria] = useState<{ id: string; name: string; description: string; weight: number } | null>(null)

  const [appliedTemplate, setAppliedTemplate] = useState<string | null>(null)
  const [confirmReplaceTemplate, setConfirmReplaceTemplate] = useState<Template | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'criteria' | 'session'; id: string } | null>(null)
  const [showEnvVars, setShowEnvVars] = useState(false)
  const [showOverflow, setShowOverflow] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  const [tabDir, setTabDir] = useState(1)
  const goToTab = (idx: number) => { setTabDir(idx > activeTab ? 1 : -1); setActiveTab(idx) }
  const overflowRef = useRef<HTMLDivElement>(null)

  type ApiKeySetting = { key: string; label: string; hint: string; isSet: boolean; source: string; preview: string; updatedAt: string | null }
  const [apiKeySettings, setApiKeySettings] = useState<ApiKeySetting[]>([])
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [keyDraft, setKeyDraft] = useState('')
  const [keySaving, setKeySaving] = useState(false)

  const [generatingNewDesc, setGeneratingNewDesc] = useState(false)
  const [generatingEditDesc, setGeneratingEditDesc] = useState(false)
  const [generatingCriteriaSet, setGeneratingCriteriaSet] = useState(false)
  const [confirmAutoGenerate, setConfirmAutoGenerate] = useState(false)

  // Close overflow on outside click
  useEffect(() => {
    if (!showOverflow) return
    const handler = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) setShowOverflow(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showOverflow])

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
          if (toView.is_active) setThemeId(toView.theme_id || 'midnight')
        }
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (!viewedSession) return
    setCriteria([]); setAppliedTemplate(null)
    supabase.from('criteria').select('*').eq('session_id', viewedSession.id).order('order_index')
      .then(({ data: c }) => {
        if (c) {
          setCriteria(c)
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
    setAppliedTemplate(null)
    setEditingSessionName(false)
    setEditingCriteria(null)
    setActiveTab(0)
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
      setThemeId(data.theme_id || currentThemeId)
    }
  }

  const deactivateSession = async (sess: Session) => {
    await supabase.from('sessions').update({ is_active: false }).eq('id', sess.id)
    setSessions(p => p.map(s => s.id === sess.id ? { ...s, is_active: false } : s))
    setViewedSession(p => p?.id === sess.id ? { ...p, is_active: false } : p)
  }

  const createSession = async () => {
    if (!newSessionName.trim()) return
    const { data, error } = await supabase.from('sessions').insert({ name: newSessionName.trim(), is_active: false, theme_id: currentThemeId }).select().single()
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
      if (next) { selectEvent(next) } else { setViewedSession(null); setBrief(''); savedBriefRef.current = ''; setCriteria([]) }
    }
    setConfirmDelete(null)
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

  const handleReorder = (newOrder: Criteria[]) => {
    setCriteria(newOrder)
    if (reorderTimer.current) clearTimeout(reorderTimer.current)
    reorderTimer.current = setTimeout(async () => {
      await Promise.all(newOrder.map((c, i) => supabase.from('criteria').update({ order_index: i }).eq('id', c.id)))
    }, 500)
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

  const generateNewCriteriaDesc = async () => {
    if (!newCritName.trim()) return
    setGeneratingNewDesc(true)
    try {
      const res = await fetch('/api/generate-criteria', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCritName, brief }),
      })
      const data = await res.json()
      if (data.description) setNewCritDesc(data.description)
    } catch (_) {}
    setGeneratingNewDesc(false)
  }

  const generateEditCriteriaDesc = async () => {
    if (!editingCriteria?.name.trim()) return
    setGeneratingEditDesc(true)
    try {
      const res = await fetch('/api/generate-criteria', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingCriteria.name, brief }),
      })
      const data = await res.json()
      if (data.description) setEditingCriteria(p => p ? { ...p, description: data.description } : null)
    } catch (_) {}
    setGeneratingEditDesc(false)
  }

  const generateCriteriaSet = async (force = false) => {
    if (!brief.trim() || !viewedSession) return
    if (criteria.length > 0 && !force) { setConfirmAutoGenerate(true); return }
    setGeneratingCriteriaSet(true)
    setConfirmAutoGenerate(false)
    try {
      const res = await fetch('/api/generate-criteria-set', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief }),
      })
      const data = await res.json()
      if (!data.criteria?.length) return
      if (criteria.length > 0) {
        await supabase.from('criteria').delete().eq('session_id', viewedSession.id)
        setCriteria([])
      }
      const rows = data.criteria.map((c: { name: string; description: string; weight: number }, i: number) => ({
        session_id: viewedSession.id, name: c.name, description: c.description, weight: c.weight, order_index: i,
      }))
      const { data: inserted } = await supabase.from('criteria').insert(rows).select()
      if (inserted) setCriteria(inserted)
    } catch (_) {
    } finally {
      setGeneratingCriteriaSet(false)
    }
  }

  const exportCsv = async () => {
    if (!viewedSession) return
    const { data: scores } = await supabase.from('scores').select('*').eq('session_id', viewedSession.id)
    if (!scores?.length) return
    const { data: teams } = await supabase.from('teams').select('*').eq('session_id', viewedSession.id)
    const headers = ['Session', 'Criterion', 'Score', 'Reasoning', 'Updated At']
    const rows = scores.map((s: any) => {
      const team = teams?.find((t: any) => t.id === s.team_id)
      const crit = criteria.find(c => c.id === s.criteria_id)
      return [
        `"${(team?.name ?? s.team_id).replace(/"/g, '""')}"`,
        `"${(crit?.name ?? s.criteria_id).replace(/"/g, '""')}"`,
        s.score,
        `"${(s.reasoning ?? '').replace(/"/g, '""')}"`,
        s.updated_at,
      ].join(',')
    })
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${viewedSession.name.replace(/[^a-z0-9]/gi, '-')}-scores.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const liveSession = sessions.find(s => s.is_active) ?? null
  const keysSet = apiKeySettings.filter(k => k.isSet).length
  const keysTotal = apiKeySettings.length

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <ThemeProvider>
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>

        <AppHeader
          back
          section="Setup"
          rightSlot={liveSession && (
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: '#4ade80' }} />
              <span className="text-sm font-semibold tracking-wider uppercase" style={{ color: '#4ade80' }}>
                {liveSession.name} · Live
              </span>
            </div>
          )}
          items={[
            { label: 'Records', href: '/records', icon: 'archive' },
            { label: 'Sign out', onClick: async () => {
              const { createClient } = await import('@/lib/supabase')
              await createClient().auth.signOut()
              window.location.href = '/login'
            }},
          ]}
        />

        <div className="flex flex-1 overflow-hidden">

          {/* ── Sidebar — same bg as main, lighter ──────────────────── */}
          <aside className="w-72 shrink-0 flex flex-col overflow-y-auto"
            style={{ borderRight: '1px solid var(--border)', background: 'var(--bg)', height: 'calc(100vh - 56px)', position: 'sticky', top: '56px' }}>

            <div className="p-4 space-y-2">
              <p className="text-base font-semibold tracking-widest uppercase px-1 mb-3" style={{ color: 'var(--text-muted)' }}>Events</p>

              <div className="flex gap-2">
                <input
                  value={newSessionName} onChange={e => setNewSessionName(e.target.value)}
                  placeholder="New event…"
                  onKeyDown={e => { if (e.key === 'Enter') createSession() }}
                  className="flex-1 px-3 py-2 rounded-lg text-base placeholder:text-[color:var(--text-muted)] focus:outline-none"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--border-hover)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                />
                <button onClick={createSession} disabled={!newSessionName.trim()}
                  className="px-3 py-2 rounded-lg text-base font-medium shrink-0 disabled:opacity-40"
                  style={{ background: 'var(--accent)', color: 'white' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              </div>

              {dbError && (
                <div className="text-base p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {dbError}
                </div>
              )}

              <div className="space-y-0.5 pt-1">
                {sessions.length === 0 && !dbError && (
                  <p className="text-base px-1 py-2" style={{ color: 'var(--text-muted)' }}>No events yet</p>
                )}
                {sessions.map(sess => {
                  const isViewed = sess.id === viewedSession?.id
                  const isLive = sess.is_active
                  return (
                    <div key={sess.id}
                      className="group relative rounded-lg transition-all cursor-pointer"
                      style={{ background: isViewed ? 'var(--accent-dim)' : 'transparent' }}
                      onClick={() => selectEvent(sess)}>
                      <div className="flex items-center gap-2 px-3 py-2">
                        <span className="h-1.5 w-1.5 rounded-full shrink-0"
                          style={{ background: isLive ? '#4ade80' : 'var(--border-hover)' }} />
                        <span className="text-base flex-1 truncate"
                          style={{ color: isViewed ? 'var(--accent)' : 'var(--text-secondary)' }}>
                          {sess.name}
                        </span>
                        <button
                          onClick={e => { e.stopPropagation(); isLive ? deactivateSession(sess) : activateSession(sess) }}
                          className="shrink-0 text-base px-1.5 py-0.5 rounded font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                          style={isLive
                            ? { color: '#4ade80', border: '1px solid rgba(74,222,128,0.35)' }
                            : { color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                          {isLive ? 'Live' : 'Go live'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="flex-1" />
          </aside>

          {/* ── Main content ──────────────────────────────────────────── */}
          <main className="flex-1 flex flex-col overflow-hidden">
            {!viewedSession ? (
              <div className="flex items-center justify-center flex-1">
                <div className="text-center space-y-3">
                  <div className="text-5xl">📋</div>
                  <p className="text-lg font-semibold" style={{ color: 'var(--text-secondary)' }}>No events yet</p>
                  <p className="text-base" style={{ color: 'var(--text-muted)' }}>Create an event in the sidebar to get started</p>
                </div>
              </div>
            ) : (
              <>
                {/* ── Fixed top: event header + banners + tab bar ── */}
                <div className="shrink-0 pt-8">
                  <div className="max-w-2xl mx-auto px-10">

                    {/* Event header */}
                    <div className="flex items-start justify-between gap-4 mb-5">
                      <div className="min-w-0">
                        {editingSessionName ? (
                          <div className="flex items-center gap-2">
                            <input
                              value={sessionNameDraft} onChange={e => setSessionNameDraft(e.target.value)}
                              autoFocus
                              onKeyDown={e => { if (e.key === 'Enter') saveSessionName(); if (e.key === 'Escape') setEditingSessionName(false) }}
                              className="text-2xl font-bold bg-transparent border-b-2 focus:outline-none w-64"
                              style={{ color: 'var(--text-primary)', borderColor: 'var(--accent)' }}
                            />
                            <button onClick={saveSessionName} className="text-base px-3 py-1 rounded-lg font-medium"
                              style={{ background: 'var(--accent)', color: 'white' }}>Save</button>
                            <button onClick={() => setEditingSessionName(false)} className="text-base px-3 py-1 rounded-lg"
                              style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>Cancel</button>
                          </div>
                        ) : (
                          <button className="group flex items-center gap-2 text-left"
                            onClick={() => { setSessionNameDraft(viewedSession.name); setEditingSessionName(true) }}>
                            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{viewedSession.name}</h1>
                            <svg className="opacity-0 group-hover:opacity-40 transition-opacity shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                        )}
                      </div>

                      {/* Primary action + overflow */}
                      <div className="flex items-center gap-2 shrink-0 pt-1">
                        {viewedSession.is_active ? (
                          <>
                            <button onClick={() => deactivateSession(viewedSession)}
                              className="flex items-center gap-1.5 text-base font-semibold px-3 py-1.5 rounded-xl transition-all"
                              style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'; (e.currentTarget as HTMLElement).style.color = '#f87171'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.3)' }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(74,222,128,0.1)'; (e.currentTarget as HTMLElement).style.color = '#4ade80'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(74,222,128,0.25)' }}>
                              <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: 'currentColor' }} />
                              Active
                            </button>
                            <Link href="/" className="flex items-center gap-2 text-base font-semibold px-4 py-1.5 rounded-xl"
                              style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>
                              Start evaluating
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="9 18 15 12 9 6" />
                              </svg>
                            </Link>
                          </>
                        ) : (
                          <button onClick={() => activateSession(viewedSession)}
                            className="flex items-center gap-1.5 text-base font-semibold px-3 py-1.5 rounded-xl transition-all"
                            style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(74,222,128,0.1)'; (e.currentTarget as HTMLElement).style.color = '#4ade80'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(74,222,128,0.25)' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}>
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'currentColor' }} />
                            Inactive
                          </button>
                        )}

                        {/* ··· overflow menu */}
                        <div className="relative" ref={overflowRef}>
                          <button
                            onClick={() => setShowOverflow(v => !v)}
                            className="p-1.5 rounded-lg transition-all"
                            style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hover)' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                              <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
                            </svg>
                          </button>
                          <AnimatePresence>
                            {showOverflow && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                                transition={{ duration: 0.1 }}
                                className="absolute right-0 top-full mt-1 z-30 min-w-[140px] rounded-xl py-1 overflow-hidden"
                                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                <button onClick={() => { exportCsv(); setShowOverflow(false) }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-base text-left"
                                  style={{ color: 'var(--text-secondary)' }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-card-hover)' }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                                  </svg>
                                  Export CSV
                                </button>
                                <button
                                  onClick={() => { setConfirmDelete({ type: 'session', id: viewedSession.id }); setShowOverflow(false) }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-base text-left"
                                  style={{ color: '#f87171' }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)' }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                                  </svg>
                                  Delete event
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>

                    {/* Banners */}
                    <AnimatePresence>
                      {confirmDelete?.type === 'session' && confirmDelete.id === viewedSession.id && (
                        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          className="flex items-center gap-3 px-4 py-3 rounded-xl text-base mb-4"
                          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                          <span className="flex-1">Delete <strong>{viewedSession.name}</strong> and all its data?</span>
                          <button onClick={() => deleteSession(viewedSession.id)}
                            className="px-3 py-1 rounded-lg font-medium text-base"
                            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
                            Delete
                          </button>
                          <button onClick={() => setConfirmDelete(null)} className="text-base" style={{ color: 'var(--text-muted)' }}>Cancel</button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {!viewedSession.is_active && liveSession && (
                      <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-base mb-4"
                        style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        You're editing <strong className="font-semibold mx-0.5">{viewedSession.name}</strong> — not live.
                        <strong className="font-semibold mx-0.5">{liveSession.name}</strong> is currently live.
                      </div>
                    )}
                  </div>

                </div>

                {/* ── Card panels ── */}
                <div className="flex-1 flex flex-col min-h-0 py-5 gap-3">
                  <div className="flex-1 flex items-stretch min-h-0 gap-3 px-4 max-w-3xl mx-auto w-full">

                    {/* Left nav */}
                    <button
                      onClick={() => goToTab(0)}
                      disabled={activeTab === 0}
                      className="shrink-0 self-center w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-20"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                      onMouseEnter={e => { if (activeTab !== 0) { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' } }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                    </button>

                    <div className="flex-1 relative overflow-hidden min-h-0">
                    <AnimatePresence mode="wait" custom={tabDir} initial={false}>
                      <motion.div
                        key={activeTab}
                        custom={tabDir}
                        variants={tabVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ type: 'spring', stiffness: 380, damping: 38 }}
                        drag="x"
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={0.1}
                        onDragEnd={(_, info) => {
                          if (info.offset.x < -80 && activeTab < 1) goToTab(1)
                          else if (info.offset.x > 80 && activeTab > 0) goToTab(0)
                        }}
                        className="absolute inset-0 flex flex-col rounded-2xl overflow-hidden"
                        style={{
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-hover)',
                          boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
                        }}
                      >
                        {/* Card header */}
                        <div className="shrink-0 flex items-center justify-between px-6 py-4"
                          style={{ borderBottom: '1px solid var(--border)' }}>
                          <p className="text-sm font-semibold tracking-widest uppercase"
                            style={{ color: 'var(--text-muted)' }}>
                            {activeTab === 0 ? 'Context' : `Scoring Criteria${criteria.length ? ` (${criteria.length})` : ''}`}
                          </p>
                          {activeTab === 0 ? (
                            briefStatus !== 'saved' && (
                              <span className="text-sm font-medium px-2 py-1 rounded-md"
                                style={{
                                  background: briefStatus === 'saving' ? 'rgba(99,102,241,0.12)' : 'rgba(251,191,36,0.12)',
                                  color: briefStatus === 'saving' ? 'var(--accent)' : '#fbbf24',
                                }}>
                                {briefStatus === 'saving' ? 'Saving…' : 'Unsaved'}
                              </span>
                            )
                          ) : (
                            <button
                              onClick={() => generateCriteriaSet()}
                              disabled={!brief.trim() || generatingCriteriaSet}
                              title={brief.trim() ? 'Auto-generate criteria from your context' : 'Add context first'}
                              className="flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-lg font-medium transition-all disabled:opacity-40"
                              style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--border-hover)' }}>
                              <SparkleIcon spinning={generatingCriteriaSet} />
                              {generatingCriteriaSet ? 'Generating…' : 'Auto-generate'}
                            </button>
                          )}
                        </div>

                        {/* Card body */}
                        <div className="flex-1 overflow-y-auto">
                          <div className="max-w-2xl mx-auto px-6 py-5 pb-16">
                            {activeTab === 0 ? (

                              /* ── Panel 0: Context ── */
                              <div className="space-y-3">
                                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                  What are you evaluating and what does good look like? The more specific, the more accurate the AI scoring.
                                </p>
                                <Textarea value={brief} onChange={setBrief} rows={10}
                                  placeholder={`Describe what you're evaluating and what good looks like.\n\ne.g. "5-minute investor pitch. We want a clear problem, evidence of market size, and a working prototype. Strong teams will demonstrate real traction."`} />
                              </div>

                            ) : (

                              /* ── Panel 1: Scoring Criteria + API Keys ── */
                              <div className="space-y-8">
                                <div className="space-y-3">
                                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                    What the AI scores on. Specific descriptions produce more reliable scores.
                                  </p>

                                  <AnimatePresence>
                                    {confirmAutoGenerate && (
                                      <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                        className="mb-3 p-3 rounded-xl flex items-center gap-3"
                                        style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid var(--border-hover)' }}>
                                        <SparkleIcon spinning={false} />
                                        <span className="text-base flex-1" style={{ color: 'var(--text-secondary)' }}>
                                          Replace {criteria.length} existing criteria with AI-generated ones?
                                        </span>
                                        <button onClick={() => generateCriteriaSet(true)}
                                          className="text-base px-3 py-1 rounded-lg font-medium"
                                          style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--border-hover)' }}>
                                          Replace
                                        </button>
                                        <button onClick={() => setConfirmAutoGenerate(false)} className="text-base" style={{ color: 'var(--text-muted)' }}>
                                          Cancel
                                        </button>
                                      </motion.div>
                                    )}
                                    {confirmReplaceTemplate && (
                                      <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                        className="mb-3 p-3 rounded-xl flex items-center gap-3"
                                        style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}>
                                        <span className="text-base flex-1" style={{ color: '#fbbf24' }}>
                                          Replace {criteria.length} existing criteria?
                                        </span>
                                        <button onClick={() => applyTemplate(confirmReplaceTemplate)}
                                          className="text-base px-3 py-1 rounded-lg font-medium"
                                          style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
                                          Replace
                                        </button>
                                        <button onClick={() => setConfirmReplaceTemplate(null)} className="text-base" style={{ color: 'var(--text-muted)' }}>
                                          Cancel
                                        </button>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>

                                  {/* Templates */}
                                  <div className="flex items-center gap-2 flex-wrap mb-3">
                                    <span className="text-base" style={{ color: 'var(--text-muted)' }}>
                                      {criteria.length === 0 ? 'Quick start:' : 'Template:'}
                                    </span>
                                    {TEMPLATES.map(t => (
                                      <button key={t.id} onClick={() => handleTemplateClick(t)}
                                        className="flex items-center gap-1.5 text-base px-2.5 py-1 rounded-lg font-medium transition-all"
                                        style={{
                                          background: appliedTemplate === t.id ? 'var(--accent-dim)' : 'transparent',
                                          color: appliedTemplate === t.id ? 'var(--accent)' : 'var(--text-muted)',
                                          border: `1px solid ${appliedTemplate === t.id ? 'var(--border-hover)' : 'var(--border)'}`,
                                        }}>
                                        {t.icon} {t.name}
                                        {appliedTemplate === t.id && (
                                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <polyline points="20 6 9 17 4 12" />
                                          </svg>
                                        )}
                                      </button>
                                    ))}
                                  </div>

                                  {/* Criteria list */}
                                  <Reorder.Group as="div" axis="y" values={criteria} onReorder={handleReorder} className="space-y-0.5">
                                    {criteria.map((c) => (
                                      <Reorder.Item as="div" key={c.id} value={c} layout="position">
                                        {editingCriteria?.id === c.id ? (
                                          <div className="p-4 rounded-xl space-y-3 my-1"
                                            style={{ background: 'var(--bg-card-hover)', border: '1px solid var(--border-hover)' }}>
                                            <Input value={editingCriteria.name}
                                              onChange={v => setEditingCriteria(p => p ? { ...p, name: v } : null)}
                                              placeholder="Name" autoFocus />
                                            {editingCriteria.name.trim() && (
                                              <div className="flex justify-end">
                                                <button onClick={generateEditCriteriaDesc} disabled={generatingEditDesc}
                                                  className="flex items-center gap-1.5 text-base px-3 py-1.5 rounded-lg font-medium disabled:opacity-50 transition-all"
                                                  style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--border-hover)' }}>
                                                  <SparkleIcon spinning={generatingEditDesc} />
                                                  {generatingEditDesc ? 'Generating…' : 'AI fill description'}
                                                </button>
                                              </div>
                                            )}
                                            <Textarea value={editingCriteria.description}
                                              onChange={v => setEditingCriteria(p => p ? { ...p, description: v } : null)}
                                              rows={3} placeholder="Scoring guide" />
                                            <div className="flex items-center gap-3">
                                              <div className="w-40"><WeightSelect value={editingCriteria.weight}
                                                onChange={v => setEditingCriteria(p => p ? { ...p, weight: v } : null)} /></div>
                                              <div className="flex-1" />
                                              <Btn onClick={() => setEditingCriteria(null)} variant="ghost" size="sm">Cancel</Btn>
                                              <Btn onClick={saveCriteriaEdit} size="sm" disabled={!editingCriteria.name.trim()}>Save</Btn>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="group/row -mx-2 px-2 py-3 rounded-xl flex items-start gap-3 transition-colors"
                                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-card-hover)' }}
                                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                                            <div className="shrink-0 self-center cursor-grab active:cursor-grabbing touch-none py-1"
                                              style={{ color: 'var(--text-muted)' }}>
                                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                                <circle cx="9" cy="5" r="1.5" /><circle cx="9" cy="12" r="1.5" /><circle cx="9" cy="19" r="1.5" />
                                                <circle cx="15" cy="5" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="15" cy="19" r="1.5" />
                                              </svg>
                                            </div>
                                            <div className="flex-1 min-w-0 cursor-pointer"
                                              onClick={() => setEditingCriteria({ id: c.id, name: c.name, description: c.description || '', weight: c.weight })}>
                                              <div className="flex items-center gap-2 mb-0.5">
                                                <p className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
                                                {c.weight !== 1 && (
                                                  <span className="text-base px-1.5 py-0.5 rounded font-medium"
                                                    style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                                                    ×{c.weight}
                                                  </span>
                                                )}
                                              </div>
                                              {c.description && (
                                                <p className="text-base leading-relaxed" style={{ color: 'var(--text-muted)' }}>{c.description}</p>
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
                                      </Reorder.Item>
                                    ))}
                                  </Reorder.Group>

                                  {/* Add criterion */}
                                  <div className="mt-4 pt-4 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
                                    <Input value={newCritName} onChange={setNewCritName}
                                      placeholder="Add a criterion — e.g. Clarity, Technical Depth" onEnter={createCriteria} />
                                    {newCritName.trim() && (
                                      <>
                                        <div className="flex justify-end">
                                          <button onClick={generateNewCriteriaDesc} disabled={generatingNewDesc}
                                            className="flex items-center gap-1.5 text-base px-3 py-1.5 rounded-lg font-medium disabled:opacity-50 transition-all"
                                            style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--border-hover)' }}>
                                            <SparkleIcon spinning={generatingNewDesc} />
                                            {generatingNewDesc ? 'Generating…' : 'AI fill description'}
                                          </button>
                                        </div>
                                        <Textarea value={newCritDesc} onChange={setNewCritDesc} rows={3}
                                          placeholder="Scoring guide — the more specific the better." />
                                        <div className="flex items-center gap-3">
                                          <div className="w-40"><WeightSelect value={newCritWeight} onChange={setNewCritWeight} /></div>
                                          <Btn onClick={createCriteria} disabled={!newCritName.trim()}>
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                                            </svg>
                                            Add
                                          </Btn>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {/* API Keys */}
                                <div className="pt-6 space-y-4" style={{ borderTop: '1px solid var(--border)' }}>
                                  <div className="flex items-center justify-between">
                                    <p className="text-base font-semibold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>API Keys</p>
                                    {apiKeySettings.length > 0 && (
                                      <span className="text-base px-1.5 py-0.5 rounded font-medium"
                                        style={{
                                          background: keysSet === keysTotal ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.08)',
                                          color: keysSet === keysTotal ? '#4ade80' : '#f87171',
                                        }}>
                                        {keysSet}/{keysTotal} set
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ borderTop: '1px solid var(--border)' }}>
                                    {apiKeySettings.length === 0 ? (
                                      <p className="text-base py-4" style={{ color: 'var(--text-muted)' }}>Loading…</p>
                                    ) : apiKeySettings.map((setting) => (
                                      <div key={setting.key} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <div className="py-3 flex items-center gap-3">
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                              <p className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>{setting.label}</p>
                                              <span className="text-base px-1.5 py-0.5 rounded font-medium"
                                                style={{
                                                  background: setting.isSet ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.08)',
                                                  color: setting.isSet ? '#4ade80' : '#f87171',
                                                }}>
                                                {setting.isSet ? 'saved' : 'not set'}
                                              </span>
                                            </div>
                                            <p className="text-base font-mono truncate" style={{ color: 'var(--text-muted)' }}>
                                              {setting.isSet ? setting.preview : setting.hint}
                                            </p>
                                          </div>
                                          <button
                                            onClick={() => { setEditingKey(setting.key === editingKey ? null : setting.key); setKeyDraft('') }}
                                            className="text-base px-3 py-1.5 rounded-lg shrink-0 transition-all"
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
                                              <div className="pb-3 flex gap-2">
                                                <input
                                                  type="password" value={keyDraft} onChange={e => setKeyDraft(e.target.value)}
                                                  placeholder={`Paste ${setting.label}…`} autoFocus
                                                  className="flex-1 text-base px-4 py-2.5 rounded-xl font-mono"
                                                  style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
                                                  onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
                                                  onBlur={e => { e.target.style.borderColor = 'var(--border)' }}
                                                  onKeyDown={async e => { if (e.key === 'Enter' && keyDraft.trim()) await saveApiKey(setting.key) }}
                                                />
                                                <button onClick={() => saveApiKey(setting.key)} disabled={keySaving || !keyDraft.trim()}
                                                  className="text-base px-4 py-2.5 rounded-xl font-medium shrink-0"
                                                  style={{ background: keyDraft.trim() ? 'var(--accent)' : 'var(--bg-card)', color: keyDraft.trim() ? 'white' : 'var(--text-muted)', opacity: keySaving ? 0.6 : 1 }}>
                                                  {keySaving ? 'Saving…' : 'Save'}
                                                </button>
                                                {setting.isSet && (
                                                  <button onClick={() => removeApiKey(setting.key)}
                                                    className="text-base px-3 py-2.5 rounded-xl shrink-0"
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
                                  <div className="flex items-center gap-5 flex-wrap pt-1 pb-8">
                                    {[
                                      { label: 'Anthropic Console', url: 'https://console.anthropic.com' },
                                      { label: 'Deepgram Console', url: 'https://console.deepgram.com' },
                                    ].map(({ label, url }) => (
                                      <a key={url} href={url} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-base transition-colors"
                                        style={{ color: 'var(--text-muted)' }}
                                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}>
                                        {label}
                                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                          <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                                        </svg>
                                      </a>
                                    ))}
                                    <button onClick={() => setShowEnvVars(v => !v)}
                                      className="flex items-center gap-1 text-base transition-colors"
                                      style={{ color: 'var(--text-muted)' }}
                                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}
                                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}>
                                      Env vars
                                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                        style={{ transform: showEnvVars ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                                        <polyline points="6 9 12 15 18 9" />
                                      </svg>
                                    </button>
                                    <AnimatePresence>
                                      {showEnvVars && (
                                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                                          exit={{ opacity: 0, height: 0 }} className="overflow-hidden w-full">
                                          <div className="rounded-xl overflow-hidden divide-y" style={{ border: '1px solid var(--border)' }}>
                                            {[
                                              { key: 'NEXT_PUBLIC_SUPABASE_URL', hint: 'Project Settings → API' },
                                              { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', hint: 'Public key, safe for browser' },
                                              { key: 'SUPABASE_SERVICE_ROLE_KEY', hint: 'Server-only, never in browser' },
                                              { key: 'DEEPGRAM_API_KEY', hint: 'console.deepgram.com' },
                                              { key: 'DEEPGRAM_PROJECT_ID', hint: 'Optional — enables temporary keys' },
                                              { key: 'ANTHROPIC_API_KEY', hint: 'console.anthropic.com' },
                                            ].map(({ key, hint }) => (
                                              <div key={key} className="px-4 py-3 flex items-center justify-between gap-4">
                                                <p className="text-base" style={{ color: 'var(--text-muted)' }}>{hint}</p>
                                                <code className="text-base px-2 py-1 rounded font-mono shrink-0"
                                                  style={{ background: 'var(--bg-card-hover)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                                                  {key}
                                                </code>
                                              </div>
                                            ))}
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                </div>
                              </div>

                            )}
                          </div>
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  </div>

                    {/* Right nav */}
                    <button
                      onClick={() => goToTab(1)}
                      disabled={activeTab === 1}
                      className="shrink-0 self-center w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-20"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                      onMouseEnter={e => { if (activeTab !== 1) { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' } }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  </div>

                  {/* Navigation dots */}
                  <div className="shrink-0 flex items-center justify-center gap-2">
                    {[0, 1].map(i => (
                      <button
                        key={i}
                        onClick={() => goToTab(i)}
                        className="rounded-full transition-all duration-200"
                        style={{
                          width: activeTab === i ? '20px' : '6px',
                          height: '6px',
                          background: activeTab === i ? 'var(--accent)' : 'var(--border-hover)',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </main>

        </div>
      </div>
    </ThemeProvider>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SparkleIcon({ spinning }: { spinning: boolean }) {
  if (spinning) {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
    )
  }
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2z" opacity="0.9" />
      <path d="M19 14l.75 2.25L22 17l-2.25.75L19 20l-.75-2.25L16 17l2.25-.75L19 14z" opacity="0.7" />
      <path d="M5 17l.5 1.5L7 19l-1.5.5L5 21l-.5-1.5L3 19l1.5-.5L5 17z" opacity="0.6" />
    </svg>
  )
}

function InlineDeleteBtn({ isConfirming, onRequest, onConfirm, onCancel }: {
  isConfirming: boolean; onRequest: () => void; onConfirm: () => void; onCancel: () => void
}) {
  if (isConfirming) {
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-base" style={{ color: 'var(--text-muted)' }}>Delete?</span>
        <button onClick={onConfirm} className="text-base px-2 py-1 rounded-lg font-medium"
          style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
          Yes
        </button>
        <button onClick={onCancel} className="text-base px-2 py-1 rounded-lg"
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
