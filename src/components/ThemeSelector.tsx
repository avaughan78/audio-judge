'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { applyTheme, themeMap } from '@/lib/themes'
import type { ThemeId } from '@/lib/types'

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function safeThemeId(id: string): ThemeId {
  return (id in themeMap) ? id as ThemeId : 'midnight'
}

export function ThemeSelector() {
  const rawThemeId = useAppStore((s) => s.themeId)
  const setThemeId = useAppStore((s) => s.setThemeId)
  const themeId = safeThemeId(rawThemeId)

  useEffect(() => {
    applyTheme(themeMap[themeId])
  }, [themeId])

  const isDark = themeId === 'midnight'

  const toggle = () => {
    const next: ThemeId = isDark ? 'daylight' : 'midnight'
    setThemeId(next)
    applyTheme(themeMap[next])
  }

  return (
    <button
      onClick={toggle}
      title={isDark ? 'Switch to Day mode' : 'Switch to Night mode'}
      className="p-1.5 rounded-lg transition-colors"
      style={{ color: 'var(--text-muted)' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}

// Provider — apply theme from store on initial load
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const rawThemeId = useAppStore((s) => s.themeId)
  const themeId = safeThemeId(rawThemeId)

  useEffect(() => {
    applyTheme(themeMap[themeId])
  }, [themeId])

  return <>{children}</>
}
