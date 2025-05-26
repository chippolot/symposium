import Link from 'next/link'
import { Users, MessageCircle, Clock, Crown, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useState } from 'react'

interface RoomWithDetails {
    id: string
    name: string
    host_user_id: string
    payment_model: string
    ai_model: string
    is_active: boolean
    max_participants: number
    created_at: string
    updated_at: string
    participant_count: number
    last_message?: {
        content: string
        created_at: string
        role: string
    }
    last_activity: string
}

interface RoomCardProps {
    room: RoomWithDetails
    currentUserId?: string
    onRoomDeleted?: (roomId: string) => void
}

export default function RoomCard({ room, currentUserId, onRoomDeleted }: RoomCardProps) {
    const [isDeleting, setIsDeleting] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const isHost = room.host_user_id === currentUserId
    const lastMessagePreview = room.last_message?.content
        ? (room.last_message.content.slice(0, 100) + (room.last_message.content.length > 100 ? '...' : ''))
        : ''

    const timeAgo = (dateString: string) => {
        const now = new Date()
        const date = new Date(dateString)
        const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

        if (diffInMinutes < 1) return 'Just now'
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`
        if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
        return `${Math.floor(diffInMinutes / 1440)}d ago`
    }

    const getAIModelDisplay = (model: string) => {
        switch (model) {
            case 'gpt-4': return 'GPT-4'
            case 'gpt-3.5-turbo': return 'GPT-3.5'
            case 'claude-3': return 'Claude 3'
            default: return model
        }
    }

    const getPaymentModelDisplay = (model: string) => {
        switch (model) {
            case 'host_pays': return 'Host pays'
            case 'shared_pool': return 'Shared pool'
            case 'per_message': return 'Pay per message'
            default: return model
        }
    }

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setShowDeleteConfirm(true)
    }

    const handleDeleteConfirm = async (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDeleting(true)

        try {
            console.log('Attempting to delete room:', room.id)
            console.log('Current user ID:', currentUserId)
            console.log('Room host ID:', room.host_user_id)
            console.log('Is host?', isHost)

            // Double-check that user is the host
            if (room.host_user_id !== currentUserId) {
                alert('You can only delete rooms you created.')
                return
            }

            // Delete the room (this should cascade delete messages and participants due to foreign keys)
            const { error } = await supabase
                .from('rooms')
                .delete()
                .eq('id', room.id)
                .eq('host_user_id', currentUserId) // Extra safety check

            console.log('Delete result:', { error })

            if (error) {
                console.error('Delete error details:', error)
                throw error
            }

            console.log('Room deleted successfully')

            // Notify parent component
            onRoomDeleted?.(room.id)
            setShowDeleteConfirm(false)
        } catch (error) {
            console.error('Error deleting room:', error)
            alert(`Failed to delete room: ${error?.message || 'Unknown error'}`)
        } finally {
            setIsDeleting(false)
        }
    }

    const handleDeleteCancel = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setShowDeleteConfirm(false)
    }

    return (
        <div className="relative group">
            <Link href={`/room/${room.id}`}>
                <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 hover:shadow-md transition-all duration-200 hover:border-indigo-300 cursor-pointer">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                                <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors truncate">
                                    {room.name}
                                </h3>
                                {isHost && (
                                    <div title="You're the host">
                                        <Crown className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-1 sm:space-y-0 text-sm text-gray-500">
                                <span className="flex items-center space-x-1">
                                    <Users className="h-4 w-4" />
                                    <span>{room.participant_count}/{room.max_participants}</span>
                                </span>
                                <span className="hidden sm:inline">{getAIModelDisplay(room.ai_model)}</span>
                                <span className="hidden sm:inline">{getPaymentModelDisplay(room.payment_model)}</span>
                            </div>
                            {/* Mobile-only AI model and payment info */}
                            <div className="sm:hidden text-xs text-gray-400 mt-1">
                                {getAIModelDisplay(room.ai_model)} • {getPaymentModelDisplay(room.payment_model)}
                            </div>
                        </div>
                        <div className="text-xs text-gray-400 flex items-center space-x-1 flex-shrink-0 ml-2">
                            <Clock className="h-3 w-3" />
                            <span>{timeAgo(room.last_activity)}</span>
                        </div>
                    </div>

                    {/* Last Message Preview */}
                    {room.last_message ? (
                        <div className="bg-gray-50 rounded-lg p-3 mb-3">
                            <div className="flex items-center space-x-2 mb-1">
                                <MessageCircle className="h-3 w-3 text-gray-400" />
                                <span className="text-xs font-medium text-gray-600">
                                    {room.last_message.role === 'assistant' ? 'AI' : 'Last message'}:
                                </span>
                            </div>
                            <p className="text-sm text-gray-700 leading-relaxed line-clamp-2">
                                {lastMessagePreview}
                            </p>
                        </div>
                    ) : (
                        <div className="bg-gray-50 rounded-lg p-3 mb-3">
                            <p className="text-sm text-gray-500 italic">No messages yet</p>
                        </div>
                    )}

                    {/* Continue Button */}
                    <div className="flex justify-between items-center">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 group-hover:bg-indigo-200 transition-colors">
                            {room.last_message ? 'Continue conversation' : 'Start conversation'}
                        </span>

                        {/* Delete Button (only for hosts) - moved here to avoid overlap */}
                        {isHost && (
                            <button
                                onClick={handleDeleteClick}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 ml-2"
                                title="Delete symposium"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            </Link>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 max-w-sm w-full">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            Delete Symposium
                        </h3>
                        <p className="text-gray-600 mb-6">
                            Are you sure you want to delete "{room.name}"? This will permanently delete all messages and cannot be undone.
                        </p>

                        <div className="flex space-x-3">
                            <button
                                onClick={handleDeleteCancel}
                                disabled={isDeleting}
                                className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteConfirm}
                                disabled={isDeleting}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                            >
                                {isDeleting ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}