'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import CollectPage from '@/app/collect/page'

export default function CollectWithCodePage() {
  const { code } = useParams<{ code: string }>()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function authenticate() {
      const res = await fetch('/api/public/collector-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Invalid code'); return }

      const supabase = createClient()
      await supabase.auth.setSession(data.session)
      setReady(true)
    }
    if (code) authenticate()
  }, [code])

  if (error) {
    return (
      <div style={{ minHeight: '100dvh', background: '#070709', color: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', fontFamily: 'system-ui, sans-serif' }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p style={{ fontSize: '16px', fontWeight: 600, color: '#f87171' }}>Invalid collector code</p>
        <p style={{ fontSize: '13px', color: '#475569' }}>Ask the event organiser for the correct link.</p>
      </div>
    )
  }

  if (!ready) {
    return (
      <div style={{ minHeight: '100dvh', background: '#070709', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#65A30D', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return <CollectPage />
}
