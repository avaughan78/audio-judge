# AudioJudge

Real-time AI scoring for hackathons, pitch competitions, and structured interviews. Transcribes live speech with Deepgram, scores each presenter against your criteria with Claude, and displays results on a live projection screen — all updating in real time without human intervention.

---

## What it does

- **Live transcription** — streams audio from your microphone to Deepgram's Nova-2 model, producing word-accurate results within ~300ms
- **AI scoring** — every ~40 words (or every 12 seconds), Claude Haiku evaluates the transcript against your criteria and writes back scores + reasoning to the database
- **Realtime display** — a separate projection-optimised page updates live via Supabase Realtime: animated score bars, an overall circular gauge, and a live transcript ticker
- **Per-user isolation** — each account has its own events, participants, criteria, and API keys; nothing is shared between users
- **Punctuate** — a single button snapshots the current session (scores + AI summary) and starts a fresh recording slot (Session 1, Session 2…) without interrupting the audio stream

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| Auth | Supabase Auth — GitHub OAuth |
| Database + Realtime | Supabase (Postgres + Realtime channels) |
| Transcription | Deepgram Nova-2 (WebSocket streaming) |
| AI scoring | Anthropic Claude Haiku |
| State | Zustand |
| Animations | Framer Motion |
| Styles | Tailwind CSS v4 |
| Deployment | Railway |

---

## Pages

| Route | Purpose |
|---|---|
| `/` | Judge view — transcription controls, live score bars, AI summary, Punctuate |
| `/display` | Projector view — full-screen scores, session name, live ticker |
| `/collect` | Collector view — additional mic devices contribute audio to the transcript |
| `/records` | History view — all events with per-session scores and summaries |
| `/admin` | Setup — events, scoring criteria, API keys |
| `/login` | GitHub OAuth sign-in |

---

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run `supabase/schema.sql` in the SQL editor to create all tables and RLS policies
3. Enable **GitHub** as an OAuth provider under Authentication → Providers
4. Set the redirect URL to `https://your-domain.com/auth/callback`

### 2. Environment variables

Create `.env.local` (never commit this file):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

The Deepgram and Anthropic API keys are stored **per user in the database** — add them in Admin → API Keys after signing in.

Optionally set `DEEPGRAM_PROJECT_ID` in `.env.local` to enable short-lived scoped Deepgram keys (more secure — the raw key is never sent to the browser).

### 3. Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with GitHub, create an event in Admin, add criteria, and start evaluating.

---

## How scoring works

1. Audio is captured from the browser microphone and streamed to Deepgram via WebSocket
2. Final transcript chunks are appended to an in-memory buffer and written to `transcript_chunks` for the display ticker
3. After every ~40 new words (or 12-second fallback), the full buffer is sent to `/api/judge`
4. Claude Haiku scores each criterion 0–100 with one-sentence reasoning
5. Scores are only written if they are **higher** than the existing score — early, incomplete transcripts don't drag down a presenter who later delivers well
6. Claude Haiku also generates a 2–3 sentence running summary, persisted to `teams.summary`

---

## Deployment (Railway)

The app ships with `railway.toml` and `nixpacks.toml`. Set the same environment variables in Railway's Variables panel. The middleware in `src/proxy.ts` handles Railway's reverse proxy by reading `x-forwarded-host` and `x-forwarded-proto` headers.

---

## Database schema (key tables)

```
sessions           id, user_id, name, brief, is_active, active_team_id, theme_id
teams              id, session_id, name, description, order_index, summary
criteria           id, session_id, name, description, weight, order_index
scores             id, session_id, team_id, criteria_id, score, reasoning, updated_at
transcript_chunks  id, session_id, team_id, content, created_at
settings           id, user_id, key, value, updated_at
```

RLS policies ensure every row is scoped to the creating user.

---

## Themes

Five built-in themes selectable from the top bar: **Midnight** (default), **Neon**, **Aurora**, **Ember**, **Daylight**. Theme choice persists in `localStorage` and syncs to the active session so the display page matches.
