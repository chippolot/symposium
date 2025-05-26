import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Room, Message } from '@/lib/supabase'

interface RoomWithDetails extends Room {
    participant_count: number
    last_message?: {
        content: string
        created_at: string
        role: string
    }
    last_activity: string
}

export function useRooms(userId?: string) {
    const [rooms, setRooms] = useState<RoomWithDetails[]>([])
    const [loading, setLoading] = useState(false) // Start with false
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!userId) {
            setLoading(false)
            setRooms([]) // Clear rooms when no user
            return
        }

        loadRooms()
    }, [userId])

    const loadRooms = async () => {
        if (!userId) return

        try {
            setLoading(true) // Set loading to true when starting
            setError(null)

            // Get rooms where user is a participant
            const { data: participantRooms, error: participantError } = await supabase
                .from('participants')
                .select(`
          room_id,
          rooms!inner (
            id,
            name,
            host_user_id,
            payment_model,
            ai_model,
            is_active,
            max_participants,
            created_at,
            updated_at
          )
        `)
                .eq('user_id', userId)
                .eq('is_active', true)
                .order('joined_at', { ascending: false })

            if (participantError) throw participantError

            // Get additional details for each room
            const roomsWithDetails = await Promise.all(
                (participantRooms || []).map(async (participant) => {
                    const room = participant.rooms as unknown as Room

                    // Get participant count
                    const { count: participantCount } = await supabase
                        .from('participants')
                        .select('*', { count: 'exact', head: true })
                        .eq('room_id', room.id)
                        .eq('is_active', true)

                    // Get last message
                    const { data: lastMessage } = await supabase
                        .from('messages')
                        .select('content, created_at, role')
                        .eq('room_id', room.id)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .single()

                    return {
                        ...room,
                        participant_count: participantCount || 0,
                        last_message: lastMessage || undefined,
                        last_activity: lastMessage?.created_at || room.updated_at
                    }
                })
            )

            // Sort by last activity
            roomsWithDetails.sort((a, b) =>
                new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime()
            )

            setRooms(roomsWithDetails)
        } catch (err) {
            console.error('Error loading rooms:', err)
            setError('Failed to load rooms')
        } finally {
            setLoading(false)
        }
    }

    const refreshRooms = () => {
        if (userId) {
            setLoading(true) // Set loading when refreshing
            loadRooms()
        }
    }

    return {
        rooms,
        loading,
        error,
        refreshRooms
    }
}