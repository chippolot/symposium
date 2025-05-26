'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRooms } from '@/lib/hooks/useRooms'
import RoomCard from '@/components/RoomCard'
import { Plus, Users, MessageCircle, RefreshCw } from 'lucide-react'
import Link from 'next/link'

export default function Home() {
    const [user, setUser] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [authError, setAuthError] = useState<string | null>(null)
    const { rooms, loading: roomsLoading, error: roomsError, refreshRooms } = useRooms(user?.id)

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()

            if (user) {
                // Check if user's email is authorized
                try {
                    const response = await fetch('/api/auth/check', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: user.email })
                    })

                    const result = await response.json()

                    if (!result.allowed) {
                        // User is not authorized, sign them out
                        await supabase.auth.signOut()
                        setAuthError(`The email "${user.email}" is not authorized to access Symposium. Please contact the administrator for access.`)
                        setUser(null)
                    } else {
                        setUser(user)
                    }
                } catch (error) {
                    console.error('Auth check error:', error)
                    setAuthError('Error checking authorization. Please try signing in again.')
                    await supabase.auth.signOut()
                    setUser(null)
                }
            }

            setLoading(false)
        }

        // Check for auth errors in URL params
        const urlParams = new URLSearchParams(window.location.search)
        const error = urlParams.get('error')
        const email = urlParams.get('email')

        if (error) {
            switch (error) {
                case 'unauthorized_email':
                    setAuthError(`The email "${email}" is not authorized to access Symposium. Please contact the administrator for access.`)
                    break
                case 'auth_failed':
                    setAuthError('Authentication failed. Please try again.')
                    break
                case 'server_error':
                    setAuthError('Server error occurred. Please try again later.')
                    break
                case 'no_code':
                    setAuthError('Authentication code missing. Please try signing in again.')
                    break
                default:
                    setAuthError('An unknown error occurred during sign in.')
            }

            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname)
        }

        getUser()
    }, [])

    const signInWithGoogle = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`
            }
        })
    }

    const signOut = async () => {
        await supabase.auth.signOut()
        setUser(null)
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 flex flex-col">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-amber-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center space-x-3">
                            <MessageCircle className="h-8 w-8 text-amber-700" />
                            <h1 className="text-2xl font-bold text-amber-900">Symposium</h1>
                        </div>

                        {user ? (
                            <div className="flex items-center space-x-4">
                                <span className="text-sm text-amber-700">
                                    Welcome, {user.user_metadata?.name || user.email}
                                </span>
                                <button
                                    onClick={signOut}
                                    className="text-sm text-amber-600 hover:text-amber-800 transition-colors"
                                >
                                    Sign Out
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={signInWithGoogle}
                                className="bg-amber-700 text-white px-4 py-2 rounded-xl hover:bg-amber-800 transition-colors shadow-md"
                            >
                                Sign In
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Auth Error Display */}
                {authError && (
                    <div className="mb-6">
                        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 shadow-sm">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div className="ml-3">
                                    <p className="text-sm text-red-700">{authError}</p>
                                </div>
                                <div className="ml-auto pl-3">
                                    <button
                                        onClick={() => setAuthError(null)}
                                        className="text-red-400 hover:text-red-600"
                                    >
                                        <span className="sr-only">Dismiss</span>
                                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {!user ? (
                    // Landing Page
                    <div className="text-center">
                        <div className="mb-8">
                            <MessageCircle className="h-20 w-20 text-amber-700 mx-auto mb-6" />
                            <h2 className="text-4xl font-bold text-amber-900 mb-4">
                                Collaborative AI Conversations
                            </h2>
                            <p className="text-xl text-amber-800 max-w-2xl mx-auto font-medium">
                                Bring your community together for thoughtful discussions with AI.
                                Multiple minds, one conversation, infinite wisdom.
                            </p>
                        </div>

                        <div className="grid md:grid-cols-3 gap-8 mb-12">
                            <div className="bg-white/60 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-amber-100">
                                <Users className="h-8 w-8 text-amber-700 mb-4" />
                                <h3 className="font-semibold text-amber-900 mb-2">Collective Inquiry</h3>
                                <p className="text-amber-700 text-sm">
                                    Multiple thinkers can explore ideas together in the same conversation
                                </p>
                            </div>

                            <div className="bg-white/60 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-amber-100">
                                <MessageCircle className="h-8 w-8 text-amber-700 mb-4" />
                                <h3 className="font-semibold text-amber-900 mb-2">Socratic Dialogue</h3>
                                <p className="text-amber-700 text-sm">
                                    Engage with advanced AI in the spirit of philosophical inquiry
                                </p>
                            </div>

                            <div className="bg-white/60 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-amber-100">
                                <Plus className="h-8 w-8 text-amber-700 mb-4" />
                                <h3 className="font-semibold text-amber-900 mb-2">Simple Beginning</h3>
                                <p className="text-amber-700 text-sm">
                                    Create a space, invite fellow seekers, begin the conversation
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={signInWithGoogle}
                            className="bg-amber-700 text-white px-8 py-3 rounded-2xl text-lg hover:bg-amber-800 transition-colors shadow-lg font-medium"
                        >
                            Begin Your Journey - Sign In
                        </button>
                    </div>
                ) : (
                    // Dashboard
                    <div>
                        {/* Dashboard Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
                            <div>
                                <h2 className="text-3xl font-bold text-amber-900 mb-2">Your Symposiums</h2>
                                <p className="text-amber-700">
                                    {rooms.length > 0
                                        ? `You've participated in ${rooms.length} conversation${rooms.length !== 1 ? 's' : ''}`
                                        : 'Begin your first collaborative inquiry'
                                    }
                                </p>
                            </div>

                            <div className="flex items-center space-x-3 mt-4 sm:mt-0">
                                <button
                                    onClick={refreshRooms}
                                    disabled={roomsLoading}
                                    className="flex items-center space-x-2 px-4 py-2 text-amber-700 hover:text-amber-900 hover:bg-white/50 rounded-xl transition-colors"
                                >
                                    <RefreshCw className={`h-4 w-4 ${roomsLoading ? 'animate-spin' : ''}`} />
                                    <span>Refresh</span>
                                </button>

                                <Link
                                    href="/create"
                                    className="bg-amber-700 text-white px-6 py-2 rounded-xl hover:bg-amber-800 transition-colors flex items-center space-x-2 shadow-md"
                                >
                                    <Plus className="h-5 w-5" />
                                    <span>New Symposium</span>
                                </Link>
                            </div>
                        </div>

                        {/* Rooms Grid */}
                        {roomsLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-700"></div>
                            </div>
                        ) : roomsError ? (
                            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center shadow-sm">
                                <p className="text-red-600 mb-4">{roomsError}</p>
                                <button
                                    onClick={refreshRooms}
                                    className="text-red-600 hover:text-red-700 underline"
                                >
                                    Try again
                                </button>
                            </div>
                        ) : rooms.length === 0 ? (
                            // Empty State
                            <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-lg p-8 sm:p-12 text-center border border-amber-100">
                                <MessageCircle className="h-12 sm:h-16 w-12 sm:w-16 text-amber-600 mx-auto mb-4 sm:mb-6" />
                                <h3 className="text-lg sm:text-xl font-semibold text-amber-900 mb-2 sm:mb-3">No conversations yet</h3>
                                <p className="text-amber-700 mb-6 sm:mb-8 max-w-md mx-auto text-sm sm:text-base">
                                    Create your first symposium to begin exploring ideas with AI.
                                    Invite fellow thinkers, pose questions, and discover wisdom together.
                                </p>
                                <Link
                                    href="/create"
                                    className="bg-amber-700 text-white px-6 sm:px-8 py-2 sm:py-3 rounded-xl hover:bg-amber-800 transition-colors inline-flex items-center space-x-2 text-sm sm:text-base shadow-md"
                                >
                                    <Plus className="h-4 sm:h-5 w-4 sm:w-5" />
                                    <span>Create Your First Symposium</span>
                                </Link>
                            </div>
                        ) : (
                            // Rooms Grid - Mobile Optimized
                            <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                                {rooms.map((room) => (
                                    <RoomCard
                                        key={room.id}
                                        room={room}
                                        currentUserId={user.id}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Birthday Footer */}
            <footer className="bg-white/60 backdrop-blur-sm border-t border-amber-100 py-6 mt-auto">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <p className="text-amber-700 text-sm font-medium">
                        🎉 Happy Birthday Dad! Love, Ben ❤️
                    </p>
                </div>
            </footer>
        </div>
    )
}