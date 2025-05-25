import Link from 'next/link'
import { Users, MessageCircle, Clock, Crown } from 'lucide-react'

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
}

export default function RoomCard({ room, currentUserId }: RoomCardProps) {
    const isHost = room.host_user_id === currentUserId
    const lastMessagePreview = room.last_message?.content.slice(0, 100) +
        (room.last_message?.content.length > 100 ? '...' : '')

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

    return (
        <Link href={`/room/${room.id}`}>
            <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 hover:shadow-md transition-all duration-200 hover:border-indigo-300 cursor-pointer group">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                            <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors truncate">
                                {room.name}
                            </h3>
                            {isHost && (
                                <Crown className="h-4 w-4 text-yellow-500 flex-shrink-0" title="You're the host" />
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
                <div className="flex justify-end">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 group-hover:bg-indigo-200 transition-colors">
                        {room.last_message ? 'Continue conversation' : 'Start conversation'}
                    </span>
                </div>
            </div>
        </Link>
    )
}