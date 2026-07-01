'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

function LoginForm() {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleGitHubSignIn = async () => {
    setError('')
    setLoading(true)
    const supabase = createClient()
    const from = searchParams.get('from') || '/'
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(from)}`,
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>

      {/* Ambient orbs */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-200px', left: '-100px', width: '500px', height: '500px', borderRadius: '50%', opacity: 0.12,
          background: 'radial-gradient(circle, #65A30D 0%, transparent 65%)' }} />
        <div style={{ position: 'absolute', bottom: '-200px', right: '-100px', width: '400px', height: '400px', borderRadius: '50%', opacity: 0.08,
          background: 'radial-gradient(circle, #84cc16 0%, transparent 65%)' }} />
      </div>

      <div style={{ position: 'relative', width: '100%', maxWidth: '340px', padding: '0 16px' }}>

        {/* Branding */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '36px', gap: '12px' }}>
          <img src="/app-icon.svg" alt="AudioJudge" style={{ width: '64px', height: '64px', borderRadius: '16px' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.01em' }}>
              AudioJudge
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
              Real-time AI hackathon judging
            </div>
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '28px 24px' }}>
          <h1 style={{ fontSize: '14px', fontWeight: 600, color: '#e2e8f0', marginBottom: '4px' }}>Sign in</h1>
          <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>
            Use your GitHub account to continue
          </p>

          <button
            onClick={handleGitHubSignIn}
            disabled={loading}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              padding: '11px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
              background: loading ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.07)',
              color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.12)',
              cursor: loading ? 'default' : 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.18)' } }}
            onMouseLeave={e => { if (!loading) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)' } }}
          >
            {!loading && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
              </svg>
            )}
            {loading
              ? <><span style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#e2e8f0', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} /> Redirecting…</>
              : 'Continue with GitHub'
            }
          </button>

          {(error || searchParams.get('error') === 'auth_failed') && (
            <p style={{ marginTop: '12px', fontSize: '12px', color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', padding: '8px 10px' }}>
              {error || 'Sign-in failed. Please try again.'}
            </p>
          )}
        </div>

        <p style={{ marginTop: '16px', textAlign: 'center', fontSize: '11px', color: '#334155' }}>
          Your sessions and scores are private to your account.
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
