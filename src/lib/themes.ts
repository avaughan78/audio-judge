import type { ThemeId } from './types'

export interface ThemeVars {
  bg: string
  bgCard: string
  bgCardHover: string
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
    name: 'Midnight',
    description: 'Electric blue on deep space black',
    swatch: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
    vars: {
      bg: '#030711',
      bgCard: 'rgba(255,255,255,0.03)',
      bgCardHover: 'rgba(255,255,255,0.05)',
      border: 'rgba(255,255,255,0.07)',
      borderHover: 'rgba(59,130,246,0.4)',
      accent: '#3b82f6',
      accentDim: 'rgba(59,130,246,0.15)',
      accentSecondary: '#8b5cf6',
      scoreHigh: '#10b981',
      scoreMid: '#f59e0b',
      scoreLow: '#ef4444',
      glowAccent: 'rgba(59,130,246,0.4)',
      glowHigh: 'rgba(16,185,129,0.5)',
      glowMid: 'rgba(245,158,11,0.4)',
      glowLow: 'rgba(239,68,68,0.4)',
      textPrimary: '#f1f5f9',
      textSecondary: '#94a3b8',
      textMuted: '#334155',
      gradientFrom: '#3b82f6',
      gradientTo: '#8b5cf6',
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
      textSecondary: '#39ff14',
      textMuted: '#1a3d12',
      gradientFrom: '#39ff14',
      gradientTo: '#00e5ff',
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
      textMuted: '#3b2060',
      gradientFrom: '#c084fc',
      gradientTo: '#2dd4bf',
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
      textMuted: '#431407',
      gradientFrom: '#f97316',
      gradientTo: '#fbbf24',
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
  document.body.style.background = v.bg
}
