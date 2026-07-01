export type ThemeId = 'midnight' | 'neon' | 'aurora' | 'ember' | 'daylight'

export interface Session {
  id: string
  name: string
  brief: string | null
  event_date: string | null
  is_active: boolean
  active_team_id: string | null
  theme_id: ThemeId
  detection_mode: 'manual' | 'automatic'
  created_at: string
}

export interface Team {
  id: string
  session_id: string
  name: string
  description: string | null
  order_index: number
  summary: string | null
  created_at: string
}

export interface Criteria {
  id: string
  session_id: string
  name: string
  description: string | null
  weight: number
  order_index: number
}

export interface Score {
  id: string
  session_id: string
  team_id: string
  criteria_id: string
  score: number  // 0–100
  reasoning: string | null
  updated_at: string
}
