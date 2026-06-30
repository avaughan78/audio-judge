-- Run this in your Supabase SQL Editor

create extension if not exists "pgcrypto";

-- Sessions (one per hackathon event)
create table if not exists public.sessions (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  brief         text,
  event_date    date,
  is_active     boolean not null default false,
  active_team_id uuid,
  theme_id      text not null default 'midnight',
  created_at    timestamptz not null default now()
);

-- Teams
create table if not exists public.teams (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions(id) on delete cascade,
  name        text not null,
  description text,
  order_index integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.sessions
  add constraint fk_active_team
  foreign key (active_team_id) references public.teams(id)
  on delete set null
  deferrable initially deferred;

-- Judging criteria
create table if not exists public.criteria (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions(id) on delete cascade,
  name        text not null,
  description text,
  weight      numeric not null default 1.0,
  order_index integer not null default 0
);

-- Live scores (upserted on each judging cycle)
create table if not exists public.scores (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions(id) on delete cascade,
  team_id     uuid not null references public.teams(id) on delete cascade,
  criteria_id uuid not null references public.criteria(id) on delete cascade,
  score       numeric not null default 0 check (score >= 0 and score <= 100),
  reasoning   text,
  updated_at  timestamptz not null default now(),
  unique (team_id, criteria_id)
);

-- Transcript chunks (for display page ticker)
create table if not exists public.transcript_chunks (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  team_id    uuid not null references public.teams(id) on delete cascade,
  content    text not null,
  timestamp  timestamptz not null default now()
);

-- Enable realtime for live updates
alter publication supabase_realtime add table public.scores;
alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.transcript_chunks;

-- RLS policies (open — tighten for production with auth)
alter table public.sessions enable row level security;
alter table public.teams enable row level security;
alter table public.criteria enable row level security;
alter table public.scores enable row level security;
alter table public.transcript_chunks enable row level security;

create policy "allow_all_sessions"          on public.sessions          for all using (true) with check (true);
create policy "allow_all_teams"             on public.teams             for all using (true) with check (true);
create policy "allow_all_criteria"          on public.criteria          for all using (true) with check (true);
create policy "allow_all_scores"            on public.scores            for all using (true) with check (true);
create policy "allow_all_transcript_chunks" on public.transcript_chunks for all using (true) with check (true);
