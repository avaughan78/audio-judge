import type { ThemeId } from './types'

export interface ThemeVars {
  bg: string
  bgCard: string
  bgCardHover: string
  bgGlass: string
  inputBg: string
  border: string
  borderHover: string
  accent: string
  accentDim: string
  accentSecondary: string
  scoreHigh: string
  scoreMid: string
  scoreLow: string
  glowAccent: string
  glowHigh: string
  glowMid: string
  glowLow: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  gradientFrom: string
  gradientTo: string
  barTrack: string
  ringTrack: string
}

export interface Theme {
  id: ThemeId
  name: string
  description: string
  swatch: string
  vars: ThemeVars
}

export const themes: Theme[] = [
  {
    id: 'midnight',
    name: 'Night',
    description: 'Dark mode — the Audio Judge default',
    swatch: 'linear-gradient(135deg, #65A30D, #84cc16)',
    vars: {
      bg: '#070709',
      bgCard: 'rgba(255,255,255,0.03)',
      bgCardHover: 'rgba(255,255,255,0.05)',
      bgGlass: 'rgba(7,7,9,0.7)',
      inputBg: 'rgba(255,255,255,0.10)',
      border: 'rgba(255,255,255,0.06)',
      borderHover: 'rgba(101,163,13,0.4)',
      accent: '#65A30D',
      accentDim: 'rgba(101,163,13,0.1)',
      accentSecondary: '#84cc16',
      scoreHigh: '#10b981',
      scoreMid: '#f59e0b',
      scoreLow: '#ef4444',
      glowAccent: 'rgba(101,163,13,0.4)',
      glowHigh: 'rgba(16,185,129,0.5)',
      glowMid: 'rgba(245,158,11,0.4)',
      glowLow: 'rgba(239,68,68,0.4)',
      textPrimary: '#f8fafc',
      textSecondary: '#94a3b8',
      textMuted: '#475569',
      gradientFrom: '#ffffff',
      gradientTo: '#cbd5e1',
      barTrack: 'rgba(255,255,255,0.05)',
      ringTrack: 'rgba(255,255,255,0.05)',
    },
  },
  {
    id: 'daylight',
    name: 'Day',
    description: 'Light mode for bright rooms',
    swatch: 'linear-gradient(135deg, #fbbf24, #7dd3fc)',
    vars: {
      bg: '#f8fafc',
      bgCard: 'rgba(0,0,0,0.03)',
      bgCardHover: 'rgba(0,0,0,0.055)',
      bgGlass: 'rgba(255,255,255,0.85)',
      inputBg: '#ffffff',
      border: 'rgba(0,0,0,0.09)',
      borderHover: 'rgba(37,99,235,0.45)',
      accent: '#2563eb',
      accentDim: 'rgba(37,99,235,0.1)',
      accentSecondary: '#7c3aed',
      scoreHigh: '#059669',
      scoreMid: '#d97706',
      scoreLow: '#dc2626',
      glowAccent: 'rgba(37,99,235,0.2)',
      glowHigh: 'rgba(5,150,105,0.25)',
      glowMid: 'rgba(217,119,6,0.25)',
      glowLow: 'rgba(220,38,38,0.25)',
      textPrimary: '#0f172a',
      textSecondary: '#334155',
      textMuted: '#64748b',
      gradientFrom: '#2563eb',
      gradientTo: '#7c3aed',
      barTrack: 'rgba(0,0,0,0.07)',
      ringTrack: 'rgba(0,0,0,0.09)',
    },
  },
]

export const themeMap = Object.fromEntries(themes.map(t => [t.id, t])) as Record<ThemeId, Theme>

export function applyTheme(theme: Theme) {
  const r = document.documentElement
  const v = theme.vars
  r.style.setProperty('--bg', v.bg)
  r.style.setProperty('--bg-card', v.bgCard)
  r.style.setProperty('--bg-card-hover', v.bgCardHover)
  r.style.setProperty('--bg-glass', v.bgGlass)
  r.style.setProperty('--input-bg', v.inputBg)
  r.style.setProperty('--border', v.border)
  r.style.setProperty('--border-hover', v.borderHover)
  r.style.setProperty('--accent', v.accent)
  r.style.setProperty('--accent-dim', v.accentDim)
  r.style.setProperty('--accent-secondary', v.accentSecondary)
  r.style.setProperty('--score-high', v.scoreHigh)
  r.style.setProperty('--score-mid', v.scoreMid)
  r.style.setProperty('--score-low', v.scoreLow)
  r.style.setProperty('--glow-accent', v.glowAccent)
  r.style.setProperty('--glow-high', v.glowHigh)
  r.style.setProperty('--glow-mid', v.glowMid)
  r.style.setProperty('--glow-low', v.glowLow)
  r.style.setProperty('--text-primary', v.textPrimary)
  r.style.setProperty('--text-secondary', v.textSecondary)
  r.style.setProperty('--text-muted', v.textMuted)
  r.style.setProperty('--gradient-from', v.gradientFrom)
  r.style.setProperty('--gradient-to', v.gradientTo)
  r.style.setProperty('--bar-track', v.barTrack)
  r.style.setProperty('--ring-track', v.ringTrack)
  document.body.style.background = v.bg
}
