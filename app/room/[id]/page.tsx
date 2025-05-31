'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useAuthGuard } from '@/lib/auth-guard'
import { Room, Message, Participant } from '@/lib/supabase'
import { ArrowLeft, Send, Users, Share2, Copy, MessageCircle, Sparkles } from 'lucide-react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'

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
    const [subscriptionStatus, setSubscriptionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting')
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
                setSubscriptionStatus('connecting')
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

                // Check if this is a new room (no messages) and add AI introduction
                const { data: existingMessages } = await supabase
                    .from('messages')
                    .select('id')
                    .eq('room_id', roomId)
                    .limit(1)

                if (!existingMessages?.length) {
                    // Add welcome message first
                    const welcomeMessage = `✨ **Welcome to the Symposium!** ✨

This space is designed for thoughtful dialogue between participants, with the optional involvement of an AI persona.

**To speak with other participants:**
Type your message normally in the input area at the bottom of the page. Clicking the send button will post a message without requesting a response from the AI. They will simply be displayed to all participants as part of the group conversation.

**To invite an AI persona into the conversation:**
Adding '@AI' or clicking the sparkling send button will direct your message at the AI and prompt a response.

*Example:* \`@AI, what are the philosophical implications of artificial intelligence?\`

Please be respectful and attentive in your interactions. The intention of this format is to allow genuine human conversation to flourish—with AI support only when intentionally invited.

---

Let the symposium begin.`

                    const { data: systemMessage } = await supabase
                        .from('messages')
                        .insert([
                            {
                                room_id: roomId,
                                user_id: null,
                                content: welcomeMessage,
                                role: 'system'
                            }
                        ])
                        .select()
                        .single()

                    // Then add AI introduction
                    const introMessage = room?.persona_name
                        ? `Hello! I'm ${room?.persona_name}. I'll be participating in this conversation. Just mention me using @AI when you'd like my input!`
                        : "Hello! I'm your AI assistant. I'll be participating in this conversation. Just mention me using @AI when you'd like my input!"

                    const { data: aiMessage } = await supabase
                        .from('messages')
                        .insert([
                            {
                                room_id: roomId,
                                user_id: null,
                                content: introMessage,
                                role: 'assistant'
                            }
                        ])
                        .select()
                        .single()

                    // Update messages state immediately with both new messages
                    if (systemMessage && aiMessage) {
                        setMessages([systemMessage, aiMessage])
                    }
                }

                // Now that initial data is loaded, set up real-time subscriptions
                setupSubscriptions()
                setLoading(false)
            } catch (error) {
                console.error('Error initializing room:', error)
                setSubscriptionStatus('error')
                router.push('/')
            }
        }

        initializeRoom()
    }, [roomId, router, user])

    // Set up real-time subscriptions as a separate function
    const setupSubscriptions = async () => {
        if (!roomId) return

        try {
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
                        // Only fetch and add message if we don't already have it
                        if (!messages.some(msg => msg.id === payload.new.id)) {
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
                    }
                )

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
                        loadParticipants()
                    }
                )

            // Subscribe to typing indicators
            const typingSubscription = supabase
                .channel(`typing:${roomId}`)
                .on('broadcast', { event: 'typing' }, (payload) => {
                    const { user_id, user_name, is_typing } = payload.payload

                    if (user_id === user?.id) return

                    setTypingUsers(prev => {
                        if (is_typing) {
                            return prev.includes(user_name) ? prev : [...prev, user_name]
                        } else {
                            return prev.filter(name => name !== user_name)
                        }
                    })
                })

            // Subscribe to all channels and handle connection status
            await Promise.all([
                messagesSubscription.subscribe(),
                participantsSubscription.subscribe(),
                typingSubscription.subscribe()
            ])

            setSubscriptionStatus('connected')

            // Cleanup function remains the same
            return () => {
                supabase.removeChannel(messagesSubscription)
                supabase.removeChannel(participantsSubscription)
                supabase.removeChannel(typingSubscription)
                if (typingTimeoutRef.current) {
                    clearTimeout(typingTimeoutRef.current)
                }
            }
        } catch (error) {
            console.error('Error setting up subscriptions:', error)
            setSubscriptionStatus('error')
        }
    }

    // Add a visual indicator for subscription status
    const renderConnectionStatus = () => {
        if (subscriptionStatus === 'connecting') {
            return (
                <div className="fixed bottom-4 right-4 bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full text-sm flex items-center">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-yellow-800 mr-2"></div>
                    Connecting to real-time updates...
                </div>
            )
        } else if (subscriptionStatus === 'error') {
            return (
                <div className="fixed bottom-4 right-4 bg-red-100 text-red-800 px-4 py-2 rounded-full text-sm flex items-center cursor-pointer" onClick={setupSubscriptions}>
                    ⚠️ Connection error. Click to retry.
                </div>
            )
        }
        return null
    }

    // Handle unauthenticated users - store room ID and redirect to OAuth
    useEffect(() => {
        const handleUnauthenticatedUser = async () => {
            if (authLoading) return

            if (!user && !authLoading) {
                // Redirect to OAuth with room ID as query parameter
                const redirectTo = process.env.NODE_ENV === 'development'
                    ? `http://localhost:3000/auth/callback?roomId=${roomId}`
                    : `${window.location.origin}/auth/callback?roomId=${roomId}`

                await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo
                    }
                })
                return
            }
        }

        handleUnauthenticatedUser()
    }, [user, authLoading, roomId])

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
    const sendMessage = async (e: React.FormEvent, forceAIResponse: boolean = false) => {
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

            // If forceAIResponse is true, prepend @AI to the message
            const messageForAI = forceAIResponse ? `@AI ${newMessage.trim()}` : newMessage.trim()

            // Get AI response
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    roomId,
                    message: messageForAI,
                    aiModel: room?.ai_model || 'gpt-4.1-mini'
                }),
            })

            if (!response.ok) {
                throw new Error('Failed to get AI response')
            }

            const aiResponse = await response.json()

            // Only create AI message if AI should respond
            if (aiResponse.should_respond !== false && aiResponse.content) {
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
            }

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
        <div className="min-h-screen bg-gray-50 flex flex-col h-[100dvh]">
            {/* Mobile-Optimized Header */}
            <header className="bg-white shadow-sm border-b px-4 py-3 sticky top-0 z-10 flex-none">
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

            <div className="flex-1 flex relative min-h-0">
                {/* Main Chat Area */}
                <div className={`flex-1 flex flex-col transition-all duration-300 ${showParticipants ? 'lg:mr-64' : ''}`}>
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 min-h-0">
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
                                            : message.role === 'system'
                                                ? 'bg-gray-100 text-gray-900' // System messages - light gray
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
                                                <p className="text-xs text-gray-500">
                                                    {room?.persona_name || 'AI'}
                                                </p>
                                                <p className="text-xs text-gray-400 shrink-0">
                                                    {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        )}
                                        {message.role === 'system' ? (
                                            <div className="prose prose-sm max-w-none prose-pre:bg-gray-800 prose-pre:text-white [&_strong]:mt-6 [&_strong]:block [&_p:first-child]:text-center [&_p:first-child_strong]:inline-block [&_p:first-child]:!mt-0">
                                                <ReactMarkdown
                                                    components={{
                                                        p: ({ node, ...props }) => <p className="whitespace-pre-wrap mb-4" {...props} />
                                                    }}
                                                >
                                                    {message.content}
                                                </ReactMarkdown>
                                            </div>
                                        ) : (
                                            <p className="whitespace-pre-wrap text-sm sm:text-base leading-relaxed">{message.content}</p>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Mobile-Optimized Message Input */}
                    <div className="border-t bg-white p-3 sm:p-4 flex-none">
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

                        <form onSubmit={(e) => sendMessage(e, false)} className="flex space-x-2 sm:space-x-3">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => handleTyping(e.target.value)}
                                placeholder="Chat with others or use @AI to get AI response..."
                                disabled={sending}
                                className="flex-1 px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 text-base"
                            />
                            <div className="flex space-x-2">
                                <button
                                    type="submit"
                                    disabled={sending || !newMessage.trim()}
                                    className="px-3 sm:px-4 py-2 sm:py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 transition-colors"
                                    title="Send message"
                                >
                                    {sending ? (
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                    ) : (
                                        <Send className="h-5 w-5" />
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => sendMessage(e, true)}
                                    disabled={sending || !newMessage.trim()}
                                    className="px-3 sm:px-4 py-2 sm:py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 transition-colors"
                                    title="Send message and get AI response"
                                >
                                    {sending ? (
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                    ) : (
                                        <div className="flex items-center">
                                            <Send className="h-5 w-5" />
                                            <Sparkles className="h-4 w-4 ml-1" />
                                        </div>
                                    )}
                                </button>
                            </div>
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
            {renderConnectionStatus()}
        </div>
    )
}