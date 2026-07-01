'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'

export type PeerPresence = {
  deviceId: string
  role: 'judge' | 'collector'
  isRecording: boolean
}

// Supabase Presence stores an array per key (one entry per connection sharing that key).
// We deduplicate to one entry per key by taking the most recent (last in array).
function extractPeers(channel: any, myDeviceId: string): PeerPresence[] {
  const state = channel.presenceState() as Record<string, PeerPresence[]>
  return Object.entries(state)
    .filter(([key]) => key !== myDeviceId)
    .map(([, arr]) => arr[arr.length - 1])
    .filter(Boolean) as PeerPresence[]
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

    const update = () => setPeers(extractPeers(channel, myDeviceId))

    channel
      .on('presence', { event: 'sync' }, update)
      .on('presence', { event: 'join' }, update)
      .on('presence', { event: 'leave' }, update)
      .subscribe(async (status: string) => {
        if (status !== 'SUBSCRIBED') return
        subscribedRef.current = true
        await channel.track({ deviceId: myDeviceId, role: myRole, isRecording: myIsRecording })
      })

    return () => {
      subscribedRef.current = false
      channelRef.current = null
      try { channel.untrack() } catch (_) {}
      supabase.removeChannel(channel)
    }
  }, [sessionId, myDeviceId, myRole])

  // Re-track when recording state changes without recreating the channel
  useEffect(() => {
    if (!subscribedRef.current || !channelRef.current) return
    channelRef.current.track({ deviceId: myDeviceId, role: myRole, isRecording: myIsRecording })
  }, [myIsRecording, myDeviceId, myRole])

  return { peers }
}
