'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Settings, Users, CreditCard } from 'lucide-react'
import Link from 'next/link'

export default function CreateRoom() {
    const router = useRouter()
    const [user, setUser] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        name: '',
        ai_model: 'gpt-4',
        payment_model: 'host_pays',
        max_participants: 5
    })

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/')
                return
            }
            setUser(user)
        }
        getUser()
    }, [router])

    const createRoom = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user) return

        setLoading(true)
        try {
            // Create room
            const { data: room, error: roomError } = await supabase
                .from('rooms')
                .insert([
                    {
                        name: formData.name,
                        host_user_id: user.id,
                        ai_model: formData.ai_model,
                        payment_model: formData.payment_model,
                        max_participants: formData.max_participants
                    }
                ])
                .select()
                .single()

            if (roomError) throw roomError

            // Add host as participant
            const { error: participantError } = await supabase
                .from('participants')
                .insert([
                    {
                        room_id: room.id,
                        user_id: user.id
                    }
                ])

            if (participantError) throw participantError

            // Redirect to room
            router.push(`/room/${room.id}`)
        } catch (error) {
            console.error('Error creating room:', error)
            alert('Error creating room. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    if (!user) {
        return <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
            {/* Header */}
            <header className="bg-white shadow-sm border-b">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center h-16">
                        <Link
                            href="/"
                            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
                        >
                            <ArrowLeft className="h-5 w-5" />
                            <span>Back to Dashboard</span>
                        </Link>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="bg-white rounded-xl shadow-sm p-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Symposium</h1>
                    <p className="text-gray-600 mb-8">
                        Set up a collaborative AI chat room for your team
                    </p>

                    <form onSubmit={createRoom} className="space-y-6">
                        {/* Room Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Room Name
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g., Product Strategy Discussion"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>

                        {/* AI Model */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                <Settings className="inline h-4 w-4 mr-1" />
                                AI Model
                            </label>
                            <select
                                value={formData.ai_model}
                                onChange={(e) => setFormData({ ...formData, ai_model: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                <option value="gpt-4">GPT-4 (Most capable, ~$0.03/1k tokens)</option>
                                <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Fast & affordable, ~$0.002/1k tokens)</option>
                                <option value="claude-3">Claude 3 (Coming soon)</option>
                            </select>
                        </div>

                        {/* Payment Model */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                <CreditCard className="inline h-4 w-4 mr-1" />
                                Payment Model
                            </label>
                            <div className="space-y-3">
                                <label className="flex items-start space-x-3">
                                    <input
                                        type="radio"
                                        name="payment_model"
                                        value="host_pays"
                                        checked={formData.payment_model === 'host_pays'}
                                        onChange={(e) => setFormData({ ...formData, payment_model: e.target.value })}
                                        className="mt-1"
                                    />
                                    <div>
                                        <div className="font-medium">Host Pays (Recommended)</div>
                                        <div className="text-sm text-gray-600">You cover all AI usage costs for this room</div>
                                    </div>
                                </label>

                                <label className="flex items-start space-x-3">
                                    <input
                                        type="radio"
                                        name="payment_model"
                                        value="shared_pool"
                                        checked={formData.payment_model === 'shared_pool'}
                                        onChange={(e) => setFormData({ ...formData, payment_model: e.target.value })}
                                        className="mt-1"
                                    />
                                    <div>
                                        <div className="font-medium">Shared Pool</div>
                                        <div className="text-sm text-gray-600">Participants can contribute credits to a shared pool</div>
                                    </div>
                                </label>

                                <label className="flex items-start space-x-3">
                                    <input
                                        type="radio"
                                        name="payment_model"
                                        value="per_message"
                                        checked={formData.payment_model === 'per_message'}
                                        onChange={(e) => setFormData({ ...formData, payment_model: e.target.value })}
                                        className="mt-1"
                                    />
                                    <div>
                                        <div className="font-medium">Pay Per Message</div>
                                        <div className="text-sm text-gray-600">Each person pays for their own messages</div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* Max Participants */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                <Users className="inline h-4 w-4 mr-1" />
                                Maximum Participants
                            </label>
                            <select
                                value={formData.max_participants}
                                onChange={(e) => setFormData({ ...formData, max_participants: parseInt(e.target.value) })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                <option value={3}>3 people</option>
                                <option value={5}>5 people</option>
                                <option value={10}>10 people</option>
                                <option value={20}>20 people</option>
                            </select>
                        </div>

                        {/* Submit */}
                        <div className="pt-6">
                            <button
                                type="submit"
                                disabled={loading || !formData.name.trim()}
                                className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {loading ? 'Creating...' : 'Create Symposium'}
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    )
}