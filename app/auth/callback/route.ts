import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')

    if (code) {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        await supabase.auth.exchangeCodeForSession(code)
    }

    // Check if there's a pending room ID in the URL (we'll pass it via query param)
    const pendingRoomId = requestUrl.searchParams.get('roomId')

    if (pendingRoomId) {
        return NextResponse.redirect(`${requestUrl.origin}/room/${pendingRoomId}`)
    }

    // Default redirect to home
    return NextResponse.redirect(requestUrl.origin)
}