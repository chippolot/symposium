'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useAuthGuard } from '@/lib/auth-guard'
import { Room, Message, Participant } from '@/lib/supabase'
import { ArrowLeft, Send, Users, Share2, Copy, MessageCircle } from 'lucide-react'
import Link from 'next/link'

interface ChatPageProps {
    params: { id: string }
}

export default function ChatRoom({ params }: ChatPageProps) {
    const router = useRouter()
    const { user, loading: authLoading, authorized } = useAuthGuard()
    const [room, setRoom] = useState<Room | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [participants, setParticipants] = useState<Participant[]>([])
    const [newMessage, setNewMessage] = useState('')
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [showParticipants, setShowParticipants] = useState(false)
    const [typingUsers, setTypingUsers] = useState<string[]>([])
    const [isTyping, setIsTyping] = useState(false)
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
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
            if (!user) return

            try {
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
    }, [roomId, router, user])

    // Set up real-time subscriptions
    useEffect(() => {
        if (!roomId) return

        // Subscribe to new messages
        const messagesSubscription = supabase
            .channel(`messages:${roomId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `room_id=eq.${roomId}`
                },
                async (payload) => {
                    console.log('New message received:', payload.new)
                    // Fetch the message with profile data
                    const { data: messageWithProfile } = await supabase
                        .from('messages')
                        .select(`
              *,
              profiles (
                name,
                email
              )
            `)
                        .eq('id', payload.new.id)
                        .single()

                    if (messageWithProfile) {
                        setMessages(prev => [...prev, messageWithProfile])
                    }
                }
            )
            .subscribe()

        // Subscribe to participant changes
        const participantsSubscription = supabase
            .channel(`participants:${roomId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'participants',
                    filter: `room_id=eq.${roomId}`
                },
                () => {
                    // Reload participants when someone joins/leaves
                    loadParticipants()
                }
            )
            .subscribe()

        // Subscribe to typing indicators
        const typingSubscription = supabase
            .channel(`typing:${roomId}`)
            .on('broadcast', { event: 'typing' }, (payload) => {
                const { user_id, user_name, is_typing } = payload.payload

                // Don't show typing indicator for current user
                if (user_id === user?.id) return

                setTypingUsers(prev => {
                    if (is_typing) {
                        // Add user to typing list if not already there
                        return prev.includes(user_name) ? prev : [...prev, user_name]
                    } else {
                        // Remove user from typing list
                        return prev.filter(name => name !== user_name)
                    }
                })
            })
            .subscribe()

        // Cleanup subscriptions
        return () => {
            supabase.removeChannel(messagesSubscription)
            supabase.removeChannel(participantsSubscription)
            supabase.removeChannel(typingSubscription)
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current)
            }
        }
    }, [roomId])

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

            // Clear input and stop typing indicator
            setNewMessage('')
            if (isTyping) {
                setIsTyping(false)
                supabase.channel(`typing:${roomId}`)
                    .send({
                        type: 'broadcast',
                        event: 'typing',
                        payload: {
                            user_id: user.id,
                            user_name: user.user_metadata?.name || user.email?.split('@')[0],
                            is_typing: false
                        }
                    })
            }

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

            // No need to reload messages - real-time subscription will handle it!

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

    // Handle typing indicator
    const handleTyping = (value: string) => {
        setNewMessage(value)

        if (!user) return

        // If user starts typing and wasn't already typing
        if (value.length > 0 && !isTyping) {
            setIsTyping(true)
            // Broadcast that user is typing
            supabase.channel(`typing:${roomId}`)
                .send({
                    type: 'broadcast',
                    event: 'typing',
                    payload: {
                        user_id: user.id,
                        user_name: user.user_metadata?.name || user.email?.split('@')[0],
                        is_typing: true
                    }
                })
        }

        // Clear existing timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current)
        }

        // Set new timeout to stop typing indicator
        typingTimeoutRef.current = setTimeout(() => {
            if (isTyping) {
                setIsTyping(false)
                // Broadcast that user stopped typing
                supabase.channel(`typing:${roomId}`)
                    .send({
                        type: 'broadcast',
                        event: 'typing',
                        payload: {
                            user_id: user.id,
                            user_name: user.user_metadata?.name || user.email?.split('@')[0],
                            is_typing: false
                        }
                    })
            }
        }, 1000) // Stop typing indicator after 1 second of no typing
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
            {/* Mobile-Optimized Header */}
            <header className="bg-white shadow-sm border-b px-4 py-3 sticky top-0 z-10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <Link href="/" className="text-gray-600 hover:text-gray-900 flex-shrink-0">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <div className="min-w-0 flex-1">
                            <h1 className="text-lg font-semibold text-gray-900 truncate">{room?.name}</h1>
                            <p className="text-sm text-gray-500">
                                {participants.length} participant{participants.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-1 flex-shrink-0">
                        <button
                            onClick={() => setShowParticipants(!showParticipants)}
                            className={`p-2 rounded-lg transition-colors ${showParticipants
                                    ? 'bg-indigo-100 text-indigo-600'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                                }`}
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

            <div className="flex-1 flex relative">
                {/* Main Chat Area */}
                <div className={`flex-1 flex flex-col transition-all duration-300 ${showParticipants ? 'lg:mr-64' : ''
                    }`}>
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
                        {messages.length === 0 ? (
                            <div className="text-center text-gray-500 mt-8 px-4">
                                <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                <p className="text-base">Start the conversation!</p>
                                <p className="text-sm mt-1">Ask the AI anything to begin your collaborative discussion.</p>
                            </div>
                        ) : (
                            messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[85%] sm:max-w-xs lg:max-w-md px-3 sm:px-4 py-2 rounded-lg ${message.role === 'user'
                                                ? message.user_id === user?.id
                                                    ? 'bg-indigo-600 text-white' // Your messages - indigo
                                                    : 'bg-emerald-600 text-white' // Other users - emerald/green
                                                : 'bg-white border text-gray-900' // AI messages - white
                                            }`}
                                    >
                                        {message.role === 'user' && (
                                            <div className="flex justify-between items-center mb-1 gap-2">
                                                <p className="text-xs opacity-75">
                                                    {message.user_id === user?.id ? 'You' : (message.profiles?.name || message.profiles?.email?.split('@')[0] || 'Anonymous')}
                                                </p>
                                                <p className="text-xs opacity-50 shrink-0">
                                                    {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        )}
                                        {message.role === 'assistant' && (
                                            <div className="flex justify-between items-center mb-1 gap-2">
                                                <p className="text-xs text-gray-500">AI</p>
                                                <p className="text-xs text-gray-400 shrink-0">
                                                    {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        )}
                                        <p className="whitespace-pre-wrap text-sm sm:text-base leading-relaxed">{message.content}</p>
                                    </div>
                                </div>
                            ))
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Mobile-Optimized Message Input */}
                    <div className="border-t bg-white p-3 sm:p-4 safe-area-bottom">
                        {/* Typing Indicator */}
                        {typingUsers.length > 0 && (
                            <div className="mb-2 px-1">
                                <div className="bg-gray-100 rounded-full px-3 py-1 inline-block">
                                    <div className="flex items-center space-x-2">
                                        <div className="flex space-x-1">
                                            <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                            <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                            <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                        </div>
                                        <span className="text-xs text-gray-500">
                                            {typingUsers.length === 1
                                                ? `${typingUsers[0]} is typing...`
                                                : `${typingUsers.slice(0, -1).join(', ')} and ${typingUsers[typingUsers.length - 1]} are typing...`
                                            }
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <form onSubmit={sendMessage} className="flex space-x-2 sm:space-x-3">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => handleTyping(e.target.value)}
                                placeholder="Ask the AI anything..."
                                disabled={sending}
                                className="flex-1 px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 text-base"
                            />
                            <button
                                type="submit"
                                disabled={sending || !newMessage.trim()}
                                className="px-3 sm:px-4 py-2 sm:py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 transition-colors"
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

                {/* Mobile-Optimized Participants Sidebar */}
                {showParticipants && (
                    <>
                        {/* Mobile Overlay */}
                        <div
                            className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
                            onClick={() => setShowParticipants(false)}
                        ></div>

                        {/* Sidebar */}
                        <div className={`
              fixed lg:absolute top-0 right-0 h-full w-80 max-w-[85vw] bg-white z-30 lg:z-10
              transform transition-transform duration-300 ease-in-out
              lg:transform-none lg:relative lg:w-64
              ${showParticipants ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
              border-l shadow-lg lg:shadow-none
            `}>
                            <div className="p-4 border-b lg:border-b-0">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold text-gray-900">Participants</h3>
                                    <button
                                        onClick={() => setShowParticipants(false)}
                                        className="lg:hidden p-1 rounded text-gray-400 hover:text-gray-600"
                                    >
                                        <ArrowLeft className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="p-4 space-y-3">
                                {participants.map((participant) => (
                                    <div key={participant.id} className="flex items-center space-x-3">
                                        <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-gray-700 truncate">
                                                {participant.profiles?.name || participant.profiles?.email?.split('@')[0] || 'Anonymous'}
                                            </p>
                                            {participant.profiles?.email && (
                                                <p className="text-xs text-gray-500 truncate">
                                                    {participant.profiles.email}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {/* Invite Section */}
                                <div className="pt-4 border-t">
                                    <button
                                        onClick={copyRoomLink}
                                        className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                                    >
                                        <Copy className="h-4 w-4" />
                                        <span className="text-sm font-medium">Copy invite link</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}