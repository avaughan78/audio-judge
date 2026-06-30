'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { themes, applyTheme, themeMap } from '@/lib/themes'
import { createClient } from '@/lib/supabase'

export function ThemeSelector() {
  const themeId = useAppStore((s) => s.themeId)
  const session = useAppStore((s) => s.session)
  const setThemeId = useAppStore((s) => s.setThemeId)

  // Apply theme on mount and when themeId changes
  useEffect(() => {
    applyTheme(themeMap[themeId])
  }, [themeId])

  const handleSelect = async (id: typeof themeId) => {
    setThemeId(id)
    applyTheme(themeMap[id])
    if (session) {
      const supabase = createClient()
      await supabase.from('sessions').update({ theme_id: id }).eq('id', session.id)
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      {themes.map((theme) => {
        const isActive = themeId === theme.id
        return (
          <motion.button
            key={theme.id}
            onClick={() => handleSelect(theme.id)}
            title={`${theme.name} — ${theme.description}`}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            className="relative w-5 h-5 rounded-full transition-all duration-200 focus:outline-none"
            style={{ background: theme.swatch, boxShadow: isActive ? `0 0 10px ${theme.vars.glowAccent}` : 'none' }}
          >
            {isActive && (
              <motion.div
                layoutId="theme-ring"
                className="absolute -inset-1 rounded-full"
                style={{ border: '1.5px solid white', opacity: 0.6 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              />
            )}
          </motion.button>
        )
      })}
    </div>
  )
}

// Provider — apply theme from store on initial load
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const themeId = useAppStore((s) => s.themeId)

  useEffect(() => {
    applyTheme(themeMap[themeId])
  }, [themeId])

  return <>{children}</>
}
