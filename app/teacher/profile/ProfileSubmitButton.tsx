'use client'

import { useFormStatus } from 'react-dom'
import { Save } from 'lucide-react'

export function ProfileSubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button 
      type="submit"
      disabled={pending}
      className="w-full sm:w-auto px-8 py-4 bg-yellow-400 text-[#0B1426] rounded-xl font-black uppercase tracking-widest hover:bg-yellow-300 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(250,204,21,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? (
        <>
          <div className="w-5 h-5 border-2 border-[#0B1426]/30 border-t-[#0B1426] rounded-full animate-spin" />
          Syncing...
        </>
      ) : (
        <>
          <Save size={18} /> Update Credentials
        </>
      )}
    </button>
  )
}