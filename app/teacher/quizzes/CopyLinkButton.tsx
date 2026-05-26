'use client'

import { useState } from 'react'
import { Link as LinkIcon, CheckCircle2 } from 'lucide-react'

export function CopyLinkButton({ quizId }: { quizId: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    // Generate URL for Campaign Info page
    const url = `${window.location.origin}/student/campaign/${quizId}`
    await navigator.clipboard.writeText(url)
    
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button 
      onClick={handleCopy}
      className="flex-1 py-3 bg-yellow-400 hover:bg-yellow-300 text-[#0B1426] rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-[0_0_15px_rgba(250,204,21,0.2)]"
      title="Copy Assessment Link"
    >
      {copied ? <CheckCircle2 size={16} /> : <LinkIcon size={16} />}
      {copied ? 'Copied!' : 'Copy Link'}
    </button>
  )
}