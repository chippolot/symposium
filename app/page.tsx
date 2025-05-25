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
    const { rooms, loading: roomsLoading, error: roomsError, refreshRooms } = useRooms(user?.id)

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            setUser(user)
            setLoading(false)
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
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
            {/* Header */}
            <header className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center space-x-3">
                            <MessageCircle className="h-8 w-8 text-indigo-600" />
                            <h1 className="text-2xl font-bold text-gray-900">Symposium</h1>
                        </div>

                        {user ? (
                            <div className="flex items-center space-x-4">
                                <span className="text-sm text-gray-600">
                                    Welcome, {user.user_metadata?.name || user.email}
                                </span>
                                <button
                                    onClick={signOut}
                                    className="text-sm text-gray-500 hover:text-gray-700"
                                >
                                    Sign Out
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={signInWithGoogle}
                                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                            >
                                Sign In
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {!user ? (
                    // Landing Page
                    <div className="text-center">
                        <div className="mb-8">
                            <MessageCircle className="h-20 w-20 text-indigo-600 mx-auto mb-6" />
                            <h2 className="text-4xl font-bold text-gray-900 mb-4">
                                Collaborative AI Conversations
                            </h2>
                            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                                Bring your team together for philosophical discussions with AI.
                                Multiple people, one conversation, endless possibilities.
                            </p>
                        </div>

                        <div className="grid md:grid-cols-3 gap-8 mb-12">
                            <div className="bg-white p-6 rounded-xl shadow-sm">
                                <Users className="h-8 w-8 text-indigo-600 mb-4" />
                                <h3 className="font-semibold text-gray-900 mb-2">Real-time Collaboration</h3>
                                <p className="text-gray-600 text-sm">
                                    Multiple people can participate in the same AI chat simultaneously
                                </p>
                            </div>

                            <div className="bg-white p-6 rounded-xl shadow-sm">
                                <MessageCircle className="h-8 w-8 text-indigo-600 mb-4" />
                                <h3 className="font-semibold text-gray-900 mb-2">AI-Powered Discussions</h3>
                                <p className="text-gray-600 text-sm">
                                    Engage with advanced AI models like GPT-4 and Claude
                                </p>
                            </div>

                            <div className="bg-white p-6 rounded-xl shadow-sm">
                                <Plus className="h-8 w-8 text-indigo-600 mb-4" />
                                <h3 className="font-semibold text-gray-900 mb-2">Easy Setup</h3>
                                <p className="text-gray-600 text-sm">
                                    Create a room, share the link, start collaborating
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={signInWithGoogle}
                            className="bg-indigo-600 text-white px-8 py-3 rounded-lg text-lg hover:bg-indigo-700 transition-colors"
                        >
                            Get Started - Sign In with Google
                        </button>
                    </div>
                ) : (
                    // Dashboard
                    <div>
                        {/* Dashboard Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
                            <div>
                                <h2 className="text-3xl font-bold text-gray-900 mb-2">Your Symposiums</h2>
                                <p className="text-gray-600">
                                    {rooms.length > 0
                                        ? `You've participated in ${rooms.length} conversation${rooms.length !== 1 ? 's' : ''}`
                                        : 'Start your first collaborative AI conversation'
                                    }
                                </p>
                            </div>

                            <div className="flex items-center space-x-3 mt-4 sm:mt-0">
                                <button
                                    onClick={refreshRooms}
                                    disabled={roomsLoading}
                                    className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition-colors"
                                >
                                    <RefreshCw className={`h-4 w-4 ${roomsLoading ? 'animate-spin' : ''}`} />
                                    <span>Refresh</span>
                                </button>

                                <Link
                                    href="/create"
                                    className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center space-x-2"
                                >
                                    <Plus className="h-5 w-5" />
                                    <span>New Room</span>
                                </Link>
                            </div>
                        </div>

                        {/* Rooms Grid */}
                        {roomsLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                            </div>
                        ) : roomsError ? (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
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
                            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                                <MessageCircle className="h-16 w-16 text-gray-400 mx-auto mb-6" />
                                <h3 className="text-xl font-semibold text-gray-900 mb-3">No conversations yet</h3>
                                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                                    Create your first symposium to start collaborating with AI.
                                    Invite friends, ask questions, and explore ideas together.
                                </p>
                                <Link
                                    href="/create"
                                    className="bg-indigo-600 text-white px-8 py-3 rounded-lg hover:bg-indigo-700 transition-colors inline-flex items-center space-x-2"
                                >
                                    <Plus className="h-5 w-5" />
                                    <span>Create Your First Room</span>
                                </Link>
                            </div>
                        ) : (
                            // Rooms Grid
                            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
        </div>
    )
}