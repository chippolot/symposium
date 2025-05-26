import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export interface Profile {
    id: string
    email: string
    name?: string
    avatar_url?: string
    credits_balance: number
    created_at: string
    updated_at: string
}

export interface Room {
    id: string
    name: string
    host_user_id: string
    payment_model: 'host_pays' | 'shared_pool' | 'per_message'
    ai_model: 'gpt-4.1' | 'gpt-4.1-mini' | 'o4-mini'
    is_active: boolean
    max_participants: number
    persona_type: 'none' | 'preset' | 'custom'
    persona_name?: string
    persona_description?: string
    created_at: string
    updated_at: string
}

export interface PresetPersona {
    id: string
    name: string
    description: string
    system_prompt: string
    created_at: string
}

export interface Participant {
    id: string
    room_id: string
    user_id: string
    joined_at: string
    is_active: boolean
    profiles?: Profile
}

export interface Message {
    id: string
    room_id: string
    user_id?: string
    content: string
    role: 'user' | 'assistant' | 'system'
    cost_cents: number
    created_at: string
    profiles?: Profile
}

export interface RoomCredit {
    id: string
    room_id: string
    contributor_user_id: string
    amount_cents: number
    created_at: string
}