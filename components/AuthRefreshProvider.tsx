'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

export default function AuthRefreshProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        if (event === 'SIGNED_OUT') {
          router.push('/auth/login')
        } else if (event === 'TOKEN_REFRESHED') {
          router.refresh()
        }
      }
    )
    return () => subscription.unsubscribe()
  }, [supabase, router])

  return <>{children}</>
}