import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Event, Session, Criteria, Score, ThemeId } from './types'

interface AppState {
  event: Event | null
  sessions: Session[]
  criteria: Criteria[]
  activeSession: Session | null
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
  judgeError: string | null

  setEvent: (s: Event | null) => void
  setSessions: (t: Session[]) => void
  setCriteria: (c: Criteria[]) => void
  setActiveSession: (t: Session | null) => void
  patchActiveSession: (patch: Partial<Session>) => void
  setScores: (scores: Record<string, Score>) => void
  updateScore: (score: Score) => void
  appendTranscript: (text: string) => void
  setInterimTranscript: (text: string) => void
  setSummary: (s: string) => void
  clearSessionState: () => void
  setRecording: (v: boolean) => void
  setConnecting: (v: boolean) => void
  setSummarising: (v: boolean) => void
  setLastJudgedAt: (t: number) => void
  setRecordingStartedAt: (t: number | null) => void
  setThemeId: (id: ThemeId) => void
  setJudgeError: (e: string | null) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      event: null,
      sessions: [],
      criteria: [],
      activeSession: null,
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
      judgeError: null,

      setEvent: (event) => set({ event }),
      setSessions: (sessions) => set({ sessions }),
      setCriteria: (criteria) => set({ criteria }),
      setActiveSession: (activeSession) =>
        set({ activeSession, scores: {}, transcript: '', interimTranscript: '', summary: '' }),
      patchActiveSession: (patch) =>
        set((state) => ({ activeSession: state.activeSession ? { ...state.activeSession, ...patch } : null })),
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
      clearSessionState: () => set({ scores: {}, transcript: '', interimTranscript: '', summary: '' }),
      setRecording: (isRecording) => set({ isRecording }),
      setConnecting: (isConnecting) => set({ isConnecting }),
      setSummarising: (isSummarising) => set({ isSummarising }),
      setLastJudgedAt: (lastJudgedAt) => set({ lastJudgedAt }),
      setRecordingStartedAt: (recordingStartedAt) => set({ recordingStartedAt }),
      setThemeId: (themeId) => set({ themeId }),
      setJudgeError: (judgeError) => set({ judgeError }),
    }),
    {
      name: 'audiojudge-store',
      partialize: (state) => ({ themeId: state.themeId }),
    }
  )
)
