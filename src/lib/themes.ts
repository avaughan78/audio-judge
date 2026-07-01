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
    name: 'Default',
    description: 'Lime green on near-black — the Audio Judge brand',
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
      gradientFrom: '#65A30D',
      gradientTo: '#84cc16',
      barTrack: 'rgba(255,255,255,0.05)',
      ringTrack: 'rgba(255,255,255,0.05)',
    },
  },
  {
    id: 'neon',
    name: 'Neon',
    description: 'Neon green cyberspace on pure black',
    swatch: 'linear-gradient(135deg, #39ff14, #00ffff)',
    vars: {
      bg: '#010201',
      bgCard: 'rgba(57,255,20,0.03)',
      bgCardHover: 'rgba(57,255,20,0.06)',
      bgGlass: 'rgba(0,0,0,0.3)',
      inputBg: 'rgba(57,255,20,0.12)',
      border: 'rgba(57,255,20,0.12)',
      borderHover: 'rgba(57,255,20,0.5)',
      accent: '#39ff14',
      accentDim: 'rgba(57,255,20,0.12)',
      accentSecondary: '#00e5ff',
      scoreHigh: '#39ff14',
      scoreMid: '#ffff00',
      scoreLow: '#ff2d78',
      glowAccent: 'rgba(57,255,20,0.45)',
      glowHigh: 'rgba(57,255,20,0.55)',
      glowMid: 'rgba(255,255,0,0.45)',
      glowLow: 'rgba(255,45,120,0.45)',
      textPrimary: '#e8ffe4',
      textSecondary: '#86efac',
      textMuted: '#4ade80',
      gradientFrom: '#39ff14',
      gradientTo: '#00e5ff',
      barTrack: 'rgba(57,255,20,0.08)',
      ringTrack: 'rgba(57,255,20,0.08)',
    },
  },
  {
    id: 'aurora',
    name: 'Aurora',
    description: 'Cosmic violet and aurora teal',
    swatch: 'linear-gradient(135deg, #c084fc, #2dd4bf)',
    vars: {
      bg: '#07031a',
      bgCard: 'rgba(192,132,252,0.04)',
      bgCardHover: 'rgba(192,132,252,0.07)',
      bgGlass: 'rgba(0,0,0,0.3)',
      inputBg: 'rgba(192,132,252,0.12)',
      border: 'rgba(192,132,252,0.1)',
      borderHover: 'rgba(192,132,252,0.5)',
      accent: '#c084fc',
      accentDim: 'rgba(192,132,252,0.15)',
      accentSecondary: '#2dd4bf',
      scoreHigh: '#2dd4bf',
      scoreMid: '#f0abfc',
      scoreLow: '#fb7185',
      glowAccent: 'rgba(192,132,252,0.4)',
      glowHigh: 'rgba(45,212,191,0.5)',
      glowMid: 'rgba(240,171,252,0.4)',
      glowLow: 'rgba(251,113,133,0.4)',
      textPrimary: '#faf5ff',
      textSecondary: '#c4b5fd',
      textMuted: '#a78bfa',
      gradientFrom: '#c084fc',
      gradientTo: '#2dd4bf',
      barTrack: 'rgba(192,132,252,0.1)',
      ringTrack: 'rgba(192,132,252,0.1)',
    },
  },
  {
    id: 'ember',
    name: 'Ember',
    description: 'Volcanic orange on dark charcoal',
    swatch: 'linear-gradient(135deg, #f97316, #fbbf24)',
    vars: {
      bg: '#0c0804',
      bgCard: 'rgba(249,115,22,0.04)',
      bgCardHover: 'rgba(249,115,22,0.07)',
      bgGlass: 'rgba(0,0,0,0.3)',
      inputBg: 'rgba(249,115,22,0.12)',
      border: 'rgba(249,115,22,0.1)',
      borderHover: 'rgba(249,115,22,0.5)',
      accent: '#f97316',
      accentDim: 'rgba(249,115,22,0.15)',
      accentSecondary: '#fbbf24',
      scoreHigh: '#4ade80',
      scoreMid: '#fbbf24',
      scoreLow: '#f87171',
      glowAccent: 'rgba(249,115,22,0.4)',
      glowHigh: 'rgba(74,222,128,0.5)',
      glowMid: 'rgba(251,191,36,0.4)',
      glowLow: 'rgba(248,113,113,0.4)',
      textPrimary: '#fef3e8',
      textSecondary: '#fb923c',
      textMuted: '#c47038',
      gradientFrom: '#f97316',
      gradientTo: '#fbbf24',
      barTrack: 'rgba(249,115,22,0.1)',
      ringTrack: 'rgba(249,115,22,0.08)',
    },
  },
  {
    id: 'daylight',
    name: 'Daylight',
    description: 'Clean light mode for bright rooms',
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
