import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { supabase } from '@/lib/supabase'

// Add type for the message with profile
interface MessageWithProfile {
    content: string
    role: 'user' | 'assistant' | 'system'
    profiles?: {
        name: string | null
        email: string | null
    }
}

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
})

export async function POST(request: NextRequest) {
    try {
        const { roomId, message, aiModel } = await request.json()

        if (!roomId || !message) {
            return NextResponse.json(
                { error: 'Missing roomId or message' },
                { status: 400 }
            )
        }

        // Get room details including persona information
        const { data: room, error: roomError } = await supabase
            .from('rooms')
            .select('*')
            .eq('id', roomId)
            .single()

        if (roomError || !room) {
            return NextResponse.json(
                { error: 'Room not found' },
                { status: 404 }
            )
        }

        // Check if AI should respond (mentioned via @AI)
        const shouldRespond = message.toLowerCase().includes('@ai')

        if (!shouldRespond) {
            return NextResponse.json({
                content: null,
                should_respond: false
            })
        }

        // Remove the @AI mention from the message
        const cleanMessage = message.replace(/@ai/gi, '').trim()

        // Get conversation history from the room
        const { data: messages, error: messagesError } = await supabase
            .from('messages')
            .select(`
                content, 
                role,
                profiles (
                    name,
                    email
                )
            `)
            .eq('room_id', roomId)
            .order('created_at', { ascending: true })
            .limit(20) as { data: MessageWithProfile[] | null, error: any } // Add type assertion

        if (messagesError) {
            console.error('Error fetching messages:', messagesError)
            return NextResponse.json(
                { error: 'Failed to fetch conversation history' },
                { status: 500 }
            )
        }

        // Build conversation context
        const conversationHistory = messages?.map(msg => {
            let content = msg.content
            if (msg.role === 'user') {
                const userName = msg.profiles?.name || msg.profiles?.email?.split('@')[0] || 'Anonymous'
                content = `[${userName}]: ${msg.content}`
            }
            return {
                role: msg.role as 'user' | 'assistant' | 'system',
                content
            }
        }) || []

        // Determine system message based on persona
        const CHARACTER_LIMIT_INSTRUCTION = '\n\nIMPORTANT: Always limit your responses to 512 characters maximum. This is a hard requirement for maintaining concise and focused dialogue.'

        let systemMessage = {
            role: 'system' as const,
            content: 'You are a helpful AI assistant participating in a collaborative discussion. Multiple people may be asking questions and discussing topics together. Be concise, helpful, and engaging.' + CHARACTER_LIMIT_INSTRUCTION
        }

        if (room.persona_type === 'preset' && room.persona_name) {
            // Get the preset persona system prompt
            const { data: persona } = await supabase
                .from('preset_personas')
                .select('system_prompt')
                .eq('name', room.persona_name)
                .single()

            if (persona) {
                systemMessage.content = persona.system_prompt + CHARACTER_LIMIT_INSTRUCTION
            }
        } else if (room.persona_type === 'custom' && room.persona_description) {
            // Use custom persona description as system prompt
            systemMessage.content = `You are ${room.persona_name || 'a custom persona'}. ${room.persona_description}

Please engage in this collaborative discussion while staying true to this persona. Multiple people may be participating in the conversation, so be aware that different users may be asking questions or making comments.${CHARACTER_LIMIT_INSTRUCTION}`
        }

        // Add the new user message
        const newUserMessage = {
            role: 'user' as const,
            content: cleanMessage
        }

        const allMessages = [
            systemMessage,
            ...conversationHistory,
            newUserMessage
        ]

        // Get AI response
        const completion = await openai.chat.completions.create({
            model: aiModel === 'gpt-4.1-mini' ? 'gpt-4.1-mini' : aiModel === 'o4-mini' ? 'o4-mini' : 'gpt-4.1',
            messages: allMessages,
            max_tokens: aiModel === 'o4-mini' ? 32768 : 32768, // o4-mini supports up to 100k, but keeping reasonable for chat
            temperature: 0.7,
        })

        const aiResponse = completion.choices[0]?.message?.content
        if (!aiResponse) {
            return NextResponse.json(
                { error: 'No response from AI' },
                { status: 500 }
            )
        }

        // Calculate cost with updated pricing (per 1M tokens)
        const inputTokens = completion.usage?.prompt_tokens || 0
        const outputTokens = completion.usage?.completion_tokens || 0

        // Convert to cost in cents (dividing by 1M tokens and multiplying by 100 for cents)
        let costCents = 0
        if (aiModel === 'gpt-4.1') {
            // GPT-4.1: $2/1M input, $8/1M output
            costCents = Math.round((inputTokens * 2 + outputTokens * 8) / 10000)
        } else if (aiModel === 'gpt-4.1-mini') {
            // GPT-4.1 Mini: $0.4/1M input, $1.6/1M output
            costCents = Math.round((inputTokens * 0.4 + outputTokens * 1.6) / 10000)
        } else if (aiModel === 'o4-mini') {
            // o4-mini: $1.1/1M input, $4.4/1M output
            costCents = Math.round((inputTokens * 1.1 + outputTokens * 4.4) / 10000)
        }

        return NextResponse.json({
            content: aiResponse,
            cost_cents: costCents,
            usage: completion.usage,
            persona_name: room.persona_name // Include persona name for display
        })

    } catch (error) {
        console.error('Chat API error:', error)

        if (error instanceof Error && error.message.includes('API key')) {
            return NextResponse.json(
                { error: 'OpenAI API key not configured' },
                { status: 500 }
            )
        }

        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}