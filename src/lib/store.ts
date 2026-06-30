import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Session, Team, Criteria, Score, ThemeId } from './types'

interface AppState {
  session: Session | null
  teams: Team[]
  criteria: Criteria[]
  activeTeam: Team | null
  scores: Record<string, Score>
  transcript: string
  summary: string
  isRecording: boolean
  isConnecting: boolean
  isSummarising: boolean
  lastJudgedAt: number
  themeId: ThemeId

  setSession: (s: Session | null) => void
  setTeams: (t: Team[]) => void
  setCriteria: (c: Criteria[]) => void
  setActiveTeam: (t: Team | null) => void
  updateScore: (score: Score) => void
  appendTranscript: (text: string) => void
  setSummary: (s: string) => void
  clearTeamState: () => void
  setRecording: (v: boolean) => void
  setConnecting: (v: boolean) => void
  setSummarising: (v: boolean) => void
  setLastJudgedAt: (t: number) => void
  setThemeId: (id: ThemeId) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      session: null,
      teams: [],
      criteria: [],
      activeTeam: null,
      scores: {},
      transcript: '',
      summary: '',
      isRecording: false,
      isConnecting: false,
      isSummarising: false,
      lastJudgedAt: 0,
      themeId: 'midnight',

      setSession: (session) => set({ session }),
      setTeams: (teams) => set({ teams }),
      setCriteria: (criteria) => set({ criteria }),
      setActiveTeam: (activeTeam) =>
        set({ activeTeam, scores: {}, transcript: '', summary: '' }),
      updateScore: (score) =>
        set((state) => ({
          scores: { ...state.scores, [score.criteria_id]: score },
        })),
      appendTranscript: (text) =>
        set((state) => ({
          transcript: state.transcript ? state.transcript + ' ' + text : text,
        })),
      setSummary: (summary) => set({ summary }),
      clearTeamState: () => set({ scores: {}, transcript: '', summary: '' }),
      setRecording: (isRecording) => set({ isRecording }),
      setConnecting: (isConnecting) => set({ isConnecting }),
      setSummarising: (isSummarising) => set({ isSummarising }),
      setLastJudgedAt: (lastJudgedAt) => set({ lastJudgedAt }),
      setThemeId: (themeId) => set({ themeId }),
    }),
    {
      name: 'audiojudge-store',
      partialize: (state) => ({ themeId: state.themeId }),
    }
  )
)
