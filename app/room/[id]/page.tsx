'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Room, Message, Participant } from '@/lib/supabase'
import { ArrowLeft, Send, Users, Share2, Copy } from 'lucide-react'
import Link from 'next/link'

interface ChatPageProps {
    params: { id: string }
}

export default function ChatRoom({ params }: ChatPageProps) {
    const router = useRouter()
    const [user, setUser] = useState<any>(null)
    const [room, setRoom] = useState<Room | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [participants, setParticipants] = useState<Participant[]>([])
    const [newMessage, setNewMessage] = useState('')
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [showParticipants, setShowParticipants] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const roomId = params.id

    // Auto-scroll to bottom when new messages arrive
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    // Initialize room and user
    useEffect(() => {
        const initializeRoom = async () => {
            try {
                // Get current user
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) {
                    router.push('/')
                    return
                }
                setUser(user)

                // Get room details
                const { data: roomData, error: roomError } = await supabase
                    .from('rooms')
                    .select('*')
                    .eq('id', roomId)
                    .single()

                if (roomError || !roomData) {
                    alert('Room not found')
                    router.push('/')
                    return
                }
                setRoom(roomData)

                // Join room as participant (if not already)
                await supabase
                    .from('participants')
                    .upsert([
                        {
                            room_id: roomId,
                            user_id: user.id
                        }
                    ])

                // Load initial data
                await loadMessages()
                await loadParticipants()

                setLoading(false)
            } catch (error) {
                console.error('Error initializing room:', error)
                router.push('/')
            }
        }

        initializeRoom()
    }, [roomId, router])

    // Load messages
    const loadMessages = async () => {
        const { data, error } = await supabase
            .from('messages')
            .select(`
        *,
        profiles (
          name,
          email
        )
      `)
            .eq('room_id', roomId)
            .order('created_at', { ascending: true })

        if (error) {
            console.error('Error loading messages:', error)
            return
        }

        setMessages(data || [])
    }

    // Load participants
    const loadParticipants = async () => {
        const { data, error } = await supabase
            .from('participants')
            .select(`
        *,
        profiles (
          name,
          email
        )
      `)
            .eq('room_id', roomId)
            .eq('is_active', true)

        if (error) {
            console.error('Error loading participants:', error)
            return
        }

        setParticipants(data || [])
    }

    // Send message and get AI response
    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newMessage.trim() || sending || !user) return

        setSending(true)
        try {
            // Add user message
            const { data: userMessage, error: messageError } = await supabase
                .from('messages')
                .insert([
                    {
                        room_id: roomId,
                        user_id: user.id,
                        content: newMessage.trim(),
                        role: 'user'
                    }
                ])
                .select()
                .single()

            if (messageError) throw messageError

            // Clear input
            setNewMessage('')

            // Get AI response
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    roomId,
                    message: newMessage.trim(),
                    aiModel: room?.ai_model || 'gpt-4'
                }),
            })

            if (!response.ok) {
                throw new Error('Failed to get AI response')
            }

            // AI response will be added via real-time subscription
            // or we'll add it here if not using real-time yet
            const aiResponse = await response.json()

            await supabase
                .from('messages')
                .insert([
                    {
                        room_id: roomId,
                        user_id: null, // AI messages have no user_id
                        content: aiResponse.content,
                        role: 'assistant',
                        cost_cents: aiResponse.cost_cents || 0
                    }
                ])

            // Reload messages to show the new ones
            await loadMessages()

        } catch (error) {
            console.error('Error sending message:', error)
            alert('Failed to send message. Please try again.')
        } finally {
            setSending(false)
        }
    }

    // Copy room link
    const copyRoomLink = () => {
        const link = `${window.location.origin}/room/${roomId}`
        navigator.clipboard.writeText(link)
        alert('Room link copied to clipboard!')
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <header className="bg-white shadow-sm border-b px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <Link href="/" className="text-gray-600 hover:text-gray-900">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <div>
                            <h1 className="text-lg font-semibold text-gray-900">{room?.name}</h1>
                            <p className="text-sm text-gray-500">
                                {participants.length} participant{participants.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => setShowParticipants(!showParticipants)}
                            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                        >
                            <Users className="h-5 w-5" />
                        </button>
                        <button
                            onClick={copyRoomLink}
                            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                        >
                            <Share2 className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex-1 flex">
                {/* Main Chat Area */}
                <div className="flex-1 flex flex-col">
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.length === 0 ? (
                            <div className="text-center text-gray-500 mt-8">
                                <p>Start the conversation! Ask the AI anything.</p>
                            </div>
                        ) : (
                            messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${message.role === 'user'
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-white border text-gray-900'
                                            }`}
                                    >
                                        {message.role === 'user' && (
                                            <p className="text-xs opacity-75 mb-1">
                                                {message.profiles?.name || 'You'}
                                            </p>
                                        )}
                                        {message.role === 'assistant' && (
                                            <p className="text-xs text-gray-500 mb-1">AI</p>
                                        )}
                                        <p className="whitespace-pre-wrap">{message.content}</p>
                                    </div>
                                </div>
                            ))
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Message Input */}
                    <div className="border-t bg-white p-4">
                        <form onSubmit={sendMessage} className="flex space-x-2">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Ask the AI anything..."
                                disabled={sending}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
                            />
                            <button
                                type="submit"
                                disabled={sending || !newMessage.trim()}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {sending ? (
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                ) : (
                                    <Send className="h-5 w-5" />
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Participants Sidebar */}
                {showParticipants && (
                    <div className="w-64 bg-white border-l p-4">
                        <h3 className="font-semibold text-gray-900 mb-4">Participants</h3>
                        <div className="space-y-2">
                            {participants.map((participant) => (
                                <div key={participant.id} className="flex items-center space-x-2">
                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                    <span className="text-sm text-gray-700">
                                        {participant.profiles?.name || participant.profiles?.email || 'Anonymous'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}