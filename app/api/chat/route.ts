import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { supabase } from '@/lib/supabase'

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

        // Get conversation history from the room
        const { data: messages, error: messagesError } = await supabase
            .from('messages')
            .select('content, role')
            .eq('room_id', roomId)
            .order('created_at', { ascending: true })
            .limit(20) // Limit context to last 20 messages

        if (messagesError) {
            console.error('Error fetching messages:', messagesError)
            return NextResponse.json(
                { error: 'Failed to fetch conversation history' },
                { status: 500 }
            )
        }

        // Build conversation context
        const conversationHistory = messages?.map(msg => ({
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content
        })) || []

        // Determine system message based on persona
        let systemMessage = {
            role: 'system' as const,
            content: 'You are a helpful AI assistant participating in a collaborative discussion. Multiple people may be asking questions and discussing topics together. Be concise, helpful, and engaging.'
        }

        if (room.persona_type === 'preset' && room.persona_name) {
            // Get the preset persona system prompt
            const { data: persona } = await supabase
                .from('preset_personas')
                .select('system_prompt')
                .eq('name', room.persona_name)
                .single()

            if (persona) {
                systemMessage.content = persona.system_prompt
            }
        } else if (room.persona_type === 'custom' && room.persona_description) {
            // Use custom persona description as system prompt
            systemMessage.content = `You are ${room.persona_name || 'a custom persona'}. ${room.persona_description}

Please engage in this collaborative discussion while staying true to this persona. Multiple people may be participating in the conversation, so be aware that different users may be asking questions or making comments.`
        }

        // Add the new user message
        const newUserMessage = {
            role: 'user' as const,
            content: message
        }

        const allMessages = [
            systemMessage,
            ...conversationHistory,
            newUserMessage
        ]

        // Get AI response
        const completion = await openai.chat.completions.create({
            model: aiModel === 'gpt-3.5-turbo' ? 'gpt-3.5-turbo' : 'gpt-4',
            messages: allMessages,
            max_tokens: 500,
            temperature: 0.7,
        })

        const aiResponse = completion.choices[0]?.message?.content
        if (!aiResponse) {
            return NextResponse.json(
                { error: 'No response from AI' },
                { status: 500 }
            )
        }

        // Calculate cost (rough estimate)
        const inputTokens = completion.usage?.prompt_tokens || 0
        const outputTokens = completion.usage?.completion_tokens || 0

        // GPT-4 pricing: $0.03/1k input tokens, $0.06/1k output tokens
        // GPT-3.5 pricing: $0.0015/1k input tokens, $0.002/1k output tokens
        let costCents = 0
        if (aiModel === 'gpt-4') {
            costCents = Math.round((inputTokens * 0.03 + outputTokens * 0.06) / 10)
        } else {
            costCents = Math.round((inputTokens * 0.0015 + outputTokens * 0.002) / 10)
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