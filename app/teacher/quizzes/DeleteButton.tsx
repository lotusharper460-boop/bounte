'use client'

import { useFormStatus } from 'react-dom'
import { Trash2 } from 'lucide-react'

export function DeleteButton() {
  // This hook automatically detects when the parent form is submitting!
  const { pending } = useFormStatus()

  return (
    <button 
      type="submit"
      disabled={pending}
      onClick={(e) => {
        // Stop the form from submitting if the user clicks "Cancel"
        if (!window.confirm("Are you sure? This will permanently delete the assessment and all student records attached to it.")) {
          e.preventDefault()
        }
      }}
      className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-50"
      title="Delete Assessment"
    >
      {pending ? (
        <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
      ) : (
        <Trash2 size={18} />
      )}
    </button>
  )
}