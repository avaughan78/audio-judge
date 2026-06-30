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
  interimTranscript: string
  summary: string
  isRecording: boolean
  isConnecting: boolean
  isSummarising: boolean
  lastJudgedAt: number
  recordingStartedAt: number | null
  themeId: ThemeId
  autoTeamCounter: number
  judgeError: string | null

  setSession: (s: Session | null) => void
  setTeams: (t: Team[]) => void
  setCriteria: (c: Criteria[]) => void
  setActiveTeam: (t: Team | null) => void
  setScores: (scores: Record<string, Score>) => void
  updateScore: (score: Score) => void
  appendTranscript: (text: string) => void
  setInterimTranscript: (text: string) => void
  setSummary: (s: string) => void
  clearTeamState: () => void
  setRecording: (v: boolean) => void
  setConnecting: (v: boolean) => void
  setSummarising: (v: boolean) => void
  setLastJudgedAt: (t: number) => void
  setRecordingStartedAt: (t: number | null) => void
  setThemeId: (id: ThemeId) => void
  incrementAutoTeamCounter: () => void
  resetAutoTeamCounter: () => void
  setJudgeError: (e: string | null) => void
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
      interimTranscript: '',
      summary: '',
      isRecording: false,
      isConnecting: false,
      isSummarising: false,
      lastJudgedAt: 0,
      recordingStartedAt: null,
      themeId: 'midnight',
      autoTeamCounter: 0,
      judgeError: null,

      setSession: (session) => set({ session }),
      setTeams: (teams) => set({ teams }),
      setCriteria: (criteria) => set({ criteria }),
      setActiveTeam: (activeTeam) =>
        set({ activeTeam, scores: {}, transcript: '', interimTranscript: '', summary: '' }),
      setScores: (scores) => set({ scores }),
      updateScore: (score) =>
        set((state) => ({
          scores: { ...state.scores, [score.criteria_id]: score },
        })),
      appendTranscript: (text) =>
        set((state) => ({
          transcript: state.transcript ? state.transcript + ' ' + text : text,
        })),
      setInterimTranscript: (interimTranscript) => set({ interimTranscript }),
      setSummary: (summary) => set({ summary }),
      clearTeamState: () => set({ scores: {}, transcript: '', interimTranscript: '', summary: '' }),
      setRecording: (isRecording) => set({ isRecording }),
      setConnecting: (isConnecting) => set({ isConnecting }),
      setSummarising: (isSummarising) => set({ isSummarising }),
      setLastJudgedAt: (lastJudgedAt) => set({ lastJudgedAt }),
      setRecordingStartedAt: (recordingStartedAt) => set({ recordingStartedAt }),
      setThemeId: (themeId) => set({ themeId }),
      incrementAutoTeamCounter: () => set((s) => ({ autoTeamCounter: s.autoTeamCounter + 1 })),
      resetAutoTeamCounter: () => set({ autoTeamCounter: 0 }),
      setJudgeError: (judgeError) => set({ judgeError }),
    }),
    {
      name: 'audiojudge-store',
      partialize: (state) => ({ themeId: state.themeId }),
    }
  )
)
