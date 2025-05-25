import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export function useAuthGuard() {
    const [user, setUser] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [authorized, setAuthorized] = useState(false)
    const router = useRouter()

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser()

                if (!user) {
                    router.push('/')
                    return
                }

                // Check if user's email is authorized
                const response = await fetch('/api/auth/check', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: user.email })
                })

                const result = await response.json()

                if (!result.allowed) {
                    // User is not authorized, sign them out and redirect
                    await supabase.auth.signOut()
                    router.push('/?error=unauthorized_email&email=' + encodeURIComponent(user.email || ''))
                    return
                }

                setUser(user)
                setAuthorized(true)
            } catch (error) {
                console.error('Auth guard error:', error)
                router.push('/')
            } finally {
                setLoading(false)
            }
        }

        checkAuth()
    }, [router])

    return { user, loading, authorized }
}