'use client';

import { signUpAction } from '@/app/actions/auth'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'

export default function AdminRegisterPage() {
  const searchParams = useSearchParams();
  const errorMessage = searchParams.get('error');

  return (
    <div 
      className="relative min-h-screen font-sans flex flex-col selection:bg-yellow-400 selection:text-black overflow-hidden bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/background.png')" }}
    >
      <div className="absolute inset-0 bg-[#0B1426]/80 backdrop-blur-sm z-0" />

      <div className="flex-1 flex flex-col w-full max-w-md mx-auto px-6 pt-12 pb-8 relative z-10">
        
        {/* Logo Section */}
        <div className="flex items-center mb-10 mt-2 select-none">
          <div className="relative w-12 h-12 sm:w-16 sm:h-16 shrink-0">
            <Image 
              src="/logo.png" 
              alt="Logo" 
              fill 
              sizes="(max-width: 768px) 48px, 64px"
              className="object-contain drop-shadow-md" 
              priority 
            />
          </div>
          <span className="text-[40px] sm:text-[48px] font-black text-white tracking-tighter drop-shadow-md leading-none ml-1">
            ounte
          </span>
        </div>

        {/* Header Texts */}
        <div className="mb-8">
          <div className="inline-block bg-[#0B1426]/80 backdrop-blur-md px-3 py-1 rounded-full border border-yellow-400/30 text-yellow-400 text-xs font-black tracking-widest mb-4 shadow-sm">
            ADMIN PORTAL
          </div>
          <h1 className="text-[42px] leading-tight font-black text-white mb-2 drop-shadow-lg">
            Command<br />Center.
          </h1>
          <p className="text-white/80 font-bold text-[15px]">Create your Admin account.</p>
        </div>

        {/* Error Feedback Box */}
        {errorMessage && (
          <div className="mb-6 rounded-2xl bg-[#0B1426]/80 backdrop-blur-md p-4 text-[14px] font-bold text-red-400 border border-red-500/30 flex items-center gap-3 shadow-xl">
            <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">⚠️</div>
            {errorMessage}
          </div>
        )}

        {/* Updated Direct Registration Form */}
        <form action={signUpAction} className="space-y-4">
          <input type="hidden" name="role" value="teacher" />

          <div>
            <input 
              type="email" 
              name="email" 
              required 
              placeholder="Work Email Address" 
              className="w-full rounded-2xl bg-transparent border border-white/10 p-4 text-white text-[15px] placeholder-slate-400 outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all backdrop-blur-sm" 
            />
          </div>
          <div>
            <input 
              type="text" 
              name="fullName" 
              required 
              placeholder="Admin Full Name" 
              className="w-full rounded-2xl bg-transparent border border-white/10 p-4 text-white text-[15px] placeholder-slate-400 outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all backdrop-blur-sm" 
            />
          </div>
          <div>
            <input 
              type="tel" 
              name="phone" 
              required 
              placeholder="Work Phone Number" 
              className="w-full rounded-2xl bg-transparent border border-white/10 p-4 text-white text-[15px] placeholder-slate-400 outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all backdrop-blur-sm" 
            />
          </div>
          <div>
            <input 
              type="password" 
              name="password" 
              required 
              minLength={6}
              placeholder="Create Password" 
              className="w-full rounded-2xl bg-transparent border border-white/10 p-4 text-white text-[15px] placeholder-slate-400 outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all backdrop-blur-sm" 
            />
          </div>

          <button 
            type="submit" 
            className="w-full rounded-2xl py-4 mt-6 font-black text-[16px] tracking-wide transition-all flex items-center justify-center gap-2 bg-yellow-400 text-[#0B1426] hover:bg-yellow-300 shadow-[0_4px_25px_rgba(250,204,21,0.25)] active:scale-[0.97]"
          >
            Activate Admin Account
          </button>
        </form>
        
        {/* Navigation Footers */}
        <div className="mt-8 text-center flex flex-col gap-4 pb-4">
          <Link href="/auth/admin/login" className="text-slate-400 text-sm font-medium hover:text-yellow-400 transition-colors">
            Already an Admin? <span className="font-bold">Log in here</span>
          </Link>
          <div className="w-full h-px bg-white/10 my-2"></div>
          <Link href="/auth/login" className="text-slate-500 text-xs font-bold uppercase tracking-wider hover:text-white transition-colors">
            ← Back to Student Portal
          </Link>
        </div>
      </div>
    </div>
  )
}