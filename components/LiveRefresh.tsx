'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function LiveRefresh({ intervalMs = 3000 }: { intervalMs?: number }) {
  const router = useRouter()

  useEffect(() => {
    // Silently refresh the server component data every X milliseconds
    const interval = setInterval(() => {
      router.refresh()
    }, intervalMs)

    return () => clearInterval(interval)
  }, [router, intervalMs])

  return null // This component is completely invisible
}