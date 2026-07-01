'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const GITHUB_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
)

const FEATURES = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" />
      </svg>
    ),
    title: 'Live transcription',
    body: 'Deepgram Nova-2 captures every word as presenters speak. Run extra microphones on any phone to fill the room.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2z" opacity="0.95" />
        <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z" opacity="0.7" />
        <path d="M5 17l.5 1.5L7 19l-1.5.5L5 21l-.5-1.5L3 19l1.5-.5L5 17z" opacity="0.5" />
      </svg>
    ),
    title: 'AI scoring',
    body: 'Claude evaluates each presentation against your criteria as the talk happens — scores and reasoning update live.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
      </svg>
    ),
    title: 'Big screen display',
    body: 'A dedicated display page shows score bars, the overall rating, and a live transcript ticker for the audience.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    title: 'Custom criteria',
    body: 'Define your own scoring rubric or load a template — hackathon pitch, job interview, or auto-generate from a brief.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" />
      </svg>
    ),
    title: 'Records & export',
    body: 'Every session is saved. Review transcripts, scores, and AI summaries after the event, and export to CSV.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    title: 'Private & secure',
    body: 'Sessions are private to your account. Audio is processed in the EU via Deepgram and never used for training.',
  },
]

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
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(from)}` },
    })
    if (error) { setError(error.message); setLoading(false) }
  }

  const hasError = !!(error || searchParams.get('error') === 'auth_failed')

  return (
    <div style={{ minHeight: '100dvh', background: '#070709', color: '#f1f5f9' }}>

      {/* Ambient glow */}
      <div aria-hidden style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-250px', right: '-150px', width: '800px', height: '800px', borderRadius: '50%', opacity: 0.07, background: 'radial-gradient(circle, #65A30D 0%, transparent 60%)' }} />
        <div style={{ position: 'absolute', bottom: '-300px', left: '-200px', width: '700px', height: '700px', borderRadius: '50%', opacity: 0.05, background: 'radial-gradient(circle, #84cc16 0%, transparent 60%)' }} />
      </div>

      {/* Nav */}
      <nav style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 40px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <img src="/app-icon.svg" alt="" style={{ width: '26px', height: '26px', borderRadius: '7px' }} />
          <span style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '-0.01em' }}>AudioJudge</span>
        </div>
        <button onClick={handleGitHubSignIn} disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 15px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, background: 'rgba(255,255,255,0.05)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.09)', cursor: 'pointer', transition: 'all 0.15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.09)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.09)' }}>
          {GITHUB_ICON}
          {loading ? 'Redirecting…' : 'Sign in'}
        </button>
      </nav>

      {/* Hero */}
      <section style={{ position: 'relative', zIndex: 10, maxWidth: '720px', margin: '0 auto', padding: '80px 40px 72px', textAlign: 'center' }}>

        <img src="/app-icon.svg" alt="AudioJudge" style={{ width: '80px', height: '80px', borderRadius: '20px', marginBottom: '28px', boxShadow: '0 0 80px rgba(101,163,13,0.2), 0 0 24px rgba(101,163,13,0.1)' }} />

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', marginBottom: '28px', padding: '5px 13px', borderRadius: '99px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#86efac', background: 'rgba(101,163,13,0.1)', border: '1px solid rgba(101,163,13,0.25)' }}>
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#65A30D', display: 'inline-block', boxShadow: '0 0 6px #65A30D' }} />
          Real-time AI judging
        </div>

        <h1 style={{ fontSize: 'clamp(36px, 6vw, 58px)', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.03em', color: '#f8fafc', marginBottom: '20px' }}>
          Score meetings & events live,<br />
          <span style={{ color: '#65A30D' }}>as they happen.</span>
        </h1>

        <p style={{ fontSize: '18px', lineHeight: 1.7, color: '#64748b', maxWidth: '540px', margin: '0 auto 40px' }}>
          AudioJudge listens to meetings and events, scores them against your criteria in real time using AI, and shows live results on the big screen.
        </p>

        {/* Primary CTA */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <button onClick={handleGitHubSignIn} disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '14px 32px', borderRadius: '12px', fontSize: '15px', fontWeight: 700, background: '#65A30D', color: 'white', border: 'none', cursor: loading ? 'default' : 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 32px rgba(101,163,13,0.4), 0 1px 2px rgba(0,0,0,0.3)', letterSpacing: '-0.01em' }}
            onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLElement).style.background = '#74b80f'; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 40px rgba(101,163,13,0.55), 0 1px 2px rgba(0,0,0,0.3)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)' } }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#65A30D'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 32px rgba(101,163,13,0.4), 0 1px 2px rgba(0,0,0,0.3)'; (e.currentTarget as HTMLElement).style.transform = 'none' }}>
            {loading
              ? <><span style={{ width: '15px', height: '15px', borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.35)', borderTopColor: 'white', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />Redirecting…</>
              : <>{GITHUB_ICON}Get started with GitHub</>
            }
          </button>

          {hasError && (
            <p style={{ fontSize: '13px', color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '9px 14px' }}>
              {error || 'Sign-in failed. Please try again.'}
            </p>
          )}

          <p style={{ fontSize: '12px', color: '#1e293b' }}>
            Free · Private to your account · EU data processing
          </p>
        </div>
      </section>

      {/* Features grid */}
      <section style={{ position: 'relative', zIndex: 10, maxWidth: '960px', margin: '0 auto', padding: '0 40px 96px' }}>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginBottom: '56px' }} />

        <p style={{ textAlign: 'center', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#334155', marginBottom: '32px' }}>
          Everything you need to run a great judging session
        </p>

        <div className="aj-features" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'rgba(255,255,255,0.06)', borderRadius: '20px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
          {FEATURES.map((f, i) => (
            <div key={f.title} style={{ padding: '28px 24px', background: '#070709', transition: 'background 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#070709' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', background: 'rgba(101,163,13,0.1)', color: '#86efac' }}>
                {f.icon}
              </div>
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#e2e8f0', marginBottom: '7px', letterSpacing: '-0.01em' }}>{f.title}</p>
              <p style={{ fontSize: '13px', lineHeight: 1.65, color: '#475569' }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA strip */}
      <section style={{ position: 'relative', zIndex: 10, borderTop: '1px solid rgba(255,255,255,0.05)', padding: '56px 40px 72px', textAlign: 'center', background: 'rgba(255,255,255,0.015)' }}>
        <p style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em', color: '#f1f5f9', marginBottom: '8px' }}>
          Ready to run your event?
        </p>
        <p style={{ fontSize: '15px', color: '#475569', marginBottom: '28px' }}>
          Set up your scoring criteria and start judging in minutes.
        </p>
        <button onClick={handleGitHubSignIn} disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '9px', padding: '12px 26px', borderRadius: '10px', fontSize: '14px', fontWeight: 700, background: 'rgba(255,255,255,0.06)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', transition: 'all 0.15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.18)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)' }}>
          {GITHUB_ICON}
          {loading ? 'Redirecting…' : 'Sign in with GitHub'}
        </button>
      </section>

      {/* Footer */}
      <footer style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '20px 40px', borderTop: '1px solid rgba(255,255,255,0.04)', fontSize: '12px', color: '#1e293b' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src="/app-icon.svg" alt="" style={{ width: '16px', height: '16px', borderRadius: '4px', opacity: 0.4 }} />
          AudioJudge · Built with Deepgram and Claude
        </div>
        <a href="https://awoken.dev" target="_blank" rel="noopener noreferrer" style={{ color: '#1e293b', textDecoration: 'none', transition: 'color 0.15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#475569' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#1e293b' }}>
          Powered by awoken.dev
        </a>
      </footer>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @media (max-width: 640px) {
          .aj-features { grid-template-columns: 1fr !important; }
        }
      `}</style>
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
