// Email allowlist checking
export function isEmailAllowed(email: string): boolean {
    if (!email) return false

    const allowedEmails = process.env.ALLOWED_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || []
    const allowedDomains = process.env.ALLOWED_DOMAINS?.split(',').map(d => d.trim().toLowerCase()) || []

    const normalizedEmail = email.toLowerCase()
    const domain = email.split('@')[1]?.toLowerCase()

    // Check if specific email is allowed
    if (allowedEmails.includes(normalizedEmail)) {
        return true
    }

    // Check if domain is allowed
    if (domain && allowedDomains.includes(domain)) {
        return true
    }

    return false
}

// For development mode - allow all emails if no restrictions set
export function isEmailAllowedWithDevMode(email: string): boolean {
    const isDevelopment = process.env.NODE_ENV === 'development'
    const hasAllowlist = process.env.ALLOWED_EMAILS || process.env.ALLOWED_DOMAINS

    // In development with no allowlist set, allow everyone
    if (isDevelopment && !hasAllowlist) {
        return true
    }

    return isEmailAllowed(email)
}