'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'

export type PeerPresence = {
  deviceId: string
  role: 'judge' | 'collector'
  isRecording: boolean
}

export function useSessionPresence(
  sessionId: string | null,
  myDeviceId: string,
  myRole: 'judge' | 'collector',
  myIsRecording: boolean,
) {
  const [peers, setPeers] = useState<PeerPresence[]>([])
  const channelRef = useRef<any>(null)
  const subscribedRef = useRef(false)

  useEffect(() => {
    if (!sessionId) return
    const supabase = createClient()
    const channel = supabase.channel(`presence:${sessionId}`, {
      config: { presence: { key: myDeviceId } },
    })
    channelRef.current = channel
    subscribedRef.current = false

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PeerPresence>()
        const others = Object.entries(state)
          .filter(([key]) => key !== myDeviceId)
          .flatMap(([, list]) => list as PeerPresence[])
        setPeers(others)
      })
      .subscribe(async (status: string) => {
        if (status !== 'SUBSCRIBED') return
        subscribedRef.current = true
        await channel.track({ deviceId: myDeviceId, role: myRole, isRecording: myIsRecording })
      })

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
      subscribedRef.current = false
    }
  }, [sessionId, myDeviceId, myRole])

  // Re-track when recording state changes
  useEffect(() => {
    if (!subscribedRef.current || !channelRef.current) return
    channelRef.current.track({ deviceId: myDeviceId, role: myRole, isRecording: myIsRecording })
  }, [myIsRecording, myDeviceId, myRole])

  return { peers }
}
