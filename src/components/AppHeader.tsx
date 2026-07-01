'use client'

import React from 'react'
import Link from 'next/link'
import { ThemeSelector } from '@/components/ThemeSelector'

export interface NavItem {
  label: string
  href?: string
  target?: string
  onClick?: () => void
  icon?: 'external' | 'mic' | 'archive' | 'settings'
  hideOnMobile?: boolean
}

interface AppHeaderProps {
  section?: string
  sectionHiddenOnMobile?: boolean
  back?: boolean
  items?: NavItem[]
  rightSlot?: React.ReactNode
  showTheme?: boolean
}

function ItemIcon({ type }: { type: NonNullable<NavItem['icon']> }) {
  const p = { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 } as const
  if (type === 'external') return <svg {...p}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
  if (type === 'mic') return <svg {...p}><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" /></svg>
  if (type === 'archive') return <svg {...p}><polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" /></svg>
  return <svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41M12 2v2M12 20v2M2 12h2M20 12h2" /></svg>
}

const CLS = 'flex items-center gap-1.5 text-sm font-semibold tracking-wider uppercase px-3 py-1.5 rounded-lg transition-colors'
const STYLE = { color: 'var(--text-muted)' as const, border: '1px solid var(--border)' as const }
const enter = (e: React.MouseEvent<HTMLElement>) => { ;(e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hover)' }
const leave = (e: React.MouseEvent<HTMLElement>) => { ;(e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }

function NavItemEl({ item }: { item: NavItem }) {
  const inner = <>{item.icon && <ItemIcon type={item.icon} />}{item.label}</>
  return item.href
    ? <Link href={item.href} target={item.target} className={CLS} style={{ ...STYLE }} onMouseEnter={enter} onMouseLeave={leave}>{inner}</Link>
    : <button onClick={item.onClick} className={CLS} style={{ ...STYLE }} onMouseEnter={enter} onMouseLeave={leave}>{inner}</button>
}

export default function AppHeader({
  section, sectionHiddenOnMobile = false, back = false,
  items = [], rightSlot, showTheme = true,
}: AppHeaderProps) {
  const mobileHidden = items.filter(i => i.hideOnMobile)
  const always = items.filter(i => !i.hideOnMobile)

  return (
    <header className="shrink-0 flex items-center justify-between px-5 h-14 sticky top-0 z-20"
      style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-glass)', backdropFilter: 'blur(12px)' }}>

      <div className="flex items-center gap-3 min-w-0">
        {back && (
          <Link href="/" className="p-1.5 rounded-lg transition-colors shrink-0"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
        )}
        <img src="/app-icon.svg" alt="Audio Judge" className="w-7 h-7 shrink-0" />
        <span className="font-bold gradient-text shrink-0">Audio Judge</span>
        {section && (
          <>
            <span className="shrink-0" style={{ color: 'var(--border-hover)' }}>·</span>
            <span className={`text-sm font-semibold tracking-wider uppercase truncate${sectionHiddenOnMobile ? ' hidden sm:inline' : ''}`}
              style={{ color: 'var(--text-muted)' }}>
              {section}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {rightSlot}
        {mobileHidden.length > 0 && (
          <div className="hidden sm:flex items-center gap-3">
            {mobileHidden.map(i => <NavItemEl key={i.label} item={i} />)}
          </div>
        )}
        {always.map(i => <NavItemEl key={i.label} item={i} />)}
        {showTheme && <ThemeSelector />}
      </div>
    </header>
  )
}
