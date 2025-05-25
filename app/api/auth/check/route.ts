import { NextRequest, NextResponse } from 'next/server'
import { isEmailAllowedWithDevMode } from '@/lib/auth-check'

export async function POST(request: NextRequest) {
    try {
        const { email } = await request.json()

        if (!email) {
            return NextResponse.json(
                { allowed: false, message: 'Email is required' },
                { status: 400 }
            )
        }

        const allowed = isEmailAllowedWithDevMode(email)

        if (!allowed) {
            return NextResponse.json(
                {
                    allowed: false,
                    message: 'This email is not authorized to access Symposium. Please contact the administrator for access.'
                },
                { status: 403 }
            )
        }

        return NextResponse.json({ allowed: true })

    } catch (error) {
        console.error('Auth check error:', error)
        return NextResponse.json(
            { allowed: false, message: 'Authentication error' },
            { status: 500 }
        )
    }
}