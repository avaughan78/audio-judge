'use client'

import { useRef, useCallback, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { getDeviceId } from '@/lib/deviceId'

export type CaptureMode = 'local' | 'online'

export function useCollectorCapture(sessionId: string | null, activeTeamId: string | null, mode: CaptureMode = 'local') {
  const deviceId = useRef(getDeviceId())
  const connectionRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const stoppedRef = useRef(false)
  const wakeLockRef = useRef<any>(null)

  const [isRecording, setIsRecording] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')

  const acquireWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return
    try {
      wakeLockRef.current = await (navigator as any).wakeLock.request('screen')
      wakeLockRef.current.addEventListener('release', () => { wakeLockRef.current = null })
    } catch (_) {}
  }, [])

  const releaseWakeLock = useCallback(() => {
    wakeLockRef.current?.release().catch(() => {})
    wakeLockRef.current = null
  }, [])

  // Re-acquire wake lock when tab becomes visible again (iOS/Android release it on hide)
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'visible' && isRecording && !wakeLockRef.current) {
      acquireWakeLock()
    }
  }, [isRecording, acquireWakeLock])

  const start = useCallback(async () => {
    if (!sessionId || !activeTeamId) return
    stoppedRef.current = false
    setIsConnecting(true)

    try {
      // Initiate media acquisition synchronously in the user-activation context
      // before any awaited network calls that would expire the activation window.
      const rawStreamPromise: Promise<MediaStream> = mode === 'online'
        ? navigator.mediaDevices.getDisplayMedia({ audio: true, video: false })
        : navigator.mediaDevices.getUserMedia({ audio: true, video: false })

      const [tokenData, rawStream] = await Promise.all([
        fetch('/api/deepgram-token').then((r) => r.json()),
        rawStreamPromise,
      ])

      if (tokenData.error) throw new Error(`Deepgram token error: ${tokenData.error}`)
      const key: string = tokenData.key
      if (!key) throw new Error('Deepgram token missing')

      if (!rawStream.getAudioTracks().length) {
        rawStream.getTracks().forEach((t) => t.stop())
        throw new Error('No audio captured — select a Chrome tab and tick "Share tab audio"')
      }
      const stream = rawStream
      streamRef.current = rawStream

      const supabase = createClient()

      const { DeepgramClient } = await import('@deepgram/sdk')
      const dg = new DeepgramClient({ apiKey: key, baseUrl: 'https://api.eu.deepgram.com' })

      const conn = await dg.listen.v1.connect({
        model: 'nova-2' as any,
        language: 'en-US' as any,
        smart_format: true as any,
        interim_results: true as any,
        endpointing: 300 as any,
        Authorization: `Token ${key}`,
      })
      connectionRef.current = conn

      conn.on('open', () => {
        if (stoppedRef.current) return
        if (mediaRecorderRef.current) return
        setIsConnecting(false)
        setIsRecording(true)
        acquireWakeLock()
        document.addEventListener('visibilitychange', handleVisibilityChange)

        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''

        const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
        mr.ondataavailable = (e) => {
          if (e.data.size > 0 && conn.readyState === 1) conn.sendMedia(e.data)
        }
        try {
          mr.start(250)
        } catch (err) {
          console.error('[collector recorder] MediaRecorder.start failed:', err)
          stoppedRef.current = true
          setIsRecording(false)
          setIsConnecting(false)
          try { (conn as any).sendCloseStream({}) } catch (_) {}
          return
        }
        mediaRecorderRef.current = mr

        stream.getTracks().forEach((track) => {
          track.addEventListener('ended', () => {
            if (stoppedRef.current) return
            stoppedRef.current = true
            try { connectionRef.current?.sendCloseStream({}) } catch (_) {}
            streamRef.current?.getTracks().forEach((t) => t.stop())
            mediaRecorderRef.current = null
            connectionRef.current = null
            streamRef.current = null
            releaseWakeLock()
            setIsRecording(false)
            setIsConnecting(false)
            setInterimTranscript('')
          })
        })
      })

      conn.on('message', (message: any) => {
        if (stoppedRef.current) return
        if (message?.type !== 'Results') return
        const alt = message?.channel?.alternatives?.[0]
        if (!alt?.transcript?.trim()) return
        if (!message.is_final) {
          setInterimTranscript(alt.transcript)
          return
        }
        setInterimTranscript('')
        setTranscript((prev) => prev + ' ' + alt.transcript)
        supabase.from('transcript_chunks')
          .insert({ session_id: sessionId, team_id: activeTeamId, content: alt.transcript, device_id: deviceId.current })
          .then(() => {})
      })

      conn.on('error', () => {
        if (stoppedRef.current) return
        setIsConnecting(false)
        setIsRecording(false)
      })

      conn.on('close', () => {
        if (stoppedRef.current) return
        setIsRecording(false)
      })

      conn.connect()
    } catch (e) {
      console.error('[collector] Start error:', e)
      setIsConnecting(false)
    }
  }, [sessionId, activeTeamId, mode, acquireWakeLock, handleVisibilityChange])

  const stop = useCallback(() => {
    stoppedRef.current = true
    mediaRecorderRef.current?.stop()
    try { connectionRef.current?.sendCloseStream({}) } catch (_) {}
    streamRef.current?.getTracks().forEach((t) => t.stop())
    mediaRecorderRef.current = null
    connectionRef.current = null
    streamRef.current = null
    releaseWakeLock()
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    setIsRecording(false)
    setIsConnecting(false)
    setInterimTranscript('')
  }, [releaseWakeLock, handleVisibilityChange])

  return {
    start,
    stop,
    isRecording,
    isConnecting,
    transcript,
    interimTranscript,
    deviceId: deviceId.current,
    hasWakeLock: typeof window !== 'undefined' && 'wakeLock' in navigator,
  }
}
