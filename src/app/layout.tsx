import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Audio Judge — Real-time Hackathon Scoring',
  description: 'Live AI-powered hackathon judging with real-time transcription and scoring',
  icons: {
    icon: [
      { url: '/app-icon.svg', type: 'image/svg+xml' },
      { url: '/app-icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

const THEME_SCRIPT = `(function(){try{
  var s=localStorage.getItem('audiojudge-store');
  if(!s)return;
  var id=(JSON.parse(s)||{}).state?.themeId;
  if(!id)return;
  var T={
    midnight:{'--bg':'#070709','--bg-card':'rgba(255,255,255,0.03)','--bg-card-hover':'rgba(255,255,255,0.05)','--bg-glass':'rgba(7,7,9,0.7)','--input-bg':'rgba(255,255,255,0.10)','--border':'rgba(255,255,255,0.06)','--border-hover':'rgba(101,163,13,0.4)','--accent':'#65A30D','--accent-dim':'rgba(101,163,13,0.1)','--accent-secondary':'#84cc16','--score-high':'#10b981','--score-mid':'#f59e0b','--score-low':'#ef4444','--glow-accent':'rgba(101,163,13,0.4)','--glow-high':'rgba(16,185,129,0.5)','--glow-mid':'rgba(245,158,11,0.4)','--glow-low':'rgba(239,68,68,0.4)','--text-primary':'#f8fafc','--text-secondary':'#94a3b8','--text-muted':'#475569','--gradient-from':'#65A30D','--gradient-to':'#84cc16','--bar-track':'rgba(255,255,255,0.05)','--ring-track':'rgba(255,255,255,0.05)'},
    aurora:{'--bg':'#07031a','--bg-card':'rgba(192,132,252,0.04)','--bg-card-hover':'rgba(192,132,252,0.07)','--bg-glass':'rgba(0,0,0,0.3)','--input-bg':'rgba(192,132,252,0.12)','--border':'rgba(192,132,252,0.1)','--border-hover':'rgba(192,132,252,0.5)','--accent':'#c084fc','--accent-dim':'rgba(192,132,252,0.15)','--accent-secondary':'#2dd4bf','--score-high':'#2dd4bf','--score-mid':'#f0abfc','--score-low':'#fb7185','--glow-accent':'rgba(192,132,252,0.4)','--glow-high':'rgba(45,212,191,0.5)','--glow-mid':'rgba(240,171,252,0.4)','--glow-low':'rgba(251,113,133,0.4)','--text-primary':'#faf5ff','--text-secondary':'#c4b5fd','--text-muted':'#a78bfa','--gradient-from':'#c084fc','--gradient-to':'#2dd4bf','--bar-track':'rgba(192,132,252,0.1)','--ring-track':'rgba(192,132,252,0.1)'},
    daylight:{'--bg':'#f8fafc','--bg-card':'rgba(0,0,0,0.03)','--bg-card-hover':'rgba(0,0,0,0.055)','--bg-glass':'rgba(255,255,255,0.85)','--input-bg':'#ffffff','--border':'rgba(0,0,0,0.09)','--border-hover':'rgba(37,99,235,0.45)','--accent':'#2563eb','--accent-dim':'rgba(37,99,235,0.1)','--accent-secondary':'#7c3aed','--score-high':'#059669','--score-mid':'#d97706','--score-low':'#dc2626','--glow-accent':'rgba(37,99,235,0.2)','--glow-high':'rgba(5,150,105,0.25)','--glow-mid':'rgba(217,119,6,0.25)','--glow-low':'rgba(220,38,38,0.25)','--text-primary':'#0f172a','--text-secondary':'#334155','--text-muted':'#64748b','--gradient-from':'#2563eb','--gradient-to':'#7c3aed','--bar-track':'rgba(0,0,0,0.07)','--ring-track':'rgba(0,0,0,0.09)'}
  };
  var v=T[id];if(!v)return;
  var r=document.documentElement;
  for(var k in v)r.style.setProperty(k,v[k]);
  document.body&&(document.body.style.background=v['--bg']);
}catch(e){}})()`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="h-full">{children}</body>
    </html>
  )
}
