import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { ArrowLeft, User, Mail, Shield, Lock, Camera, CheckCircle2 } from 'lucide-react'
import { ProfileSubmitButton } from './ProfileSubmitButton'

export default async function ProfilePage() {
  // 1. Initialize Server Client & Authenticate
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/auth/admin/login')
  }

  // 2. Fetch Existing Profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const currentName = profile?.full_name || 'User'
  const userInitial = currentName.charAt(0).toUpperCase()

  // 3. Server Action: Securely update the profile
  async function updateProfile(formData: FormData) {
    'use server'
    const fullName = formData.get('fullName') as string
    
    if (!fullName || fullName.trim() === '') return;

    const supabaseServer = await createClient()
    const { data: { user: activeUser } } = await supabaseServer.auth.getUser()
    
    if (activeUser) {
      // Use upsert with error catching
      const { error } = await supabaseServer
        .from('profiles')
        .upsert({ 
          id: activeUser.id, 
          full_name: fullName.trim() 
        })
        
      if (error) {
        console.error("🔥 Profile Sync Error:", error.message)
        return;
      }
        
      // Instantly refresh this page and the main dashboard
      revalidatePath('/teacher/profile')
      revalidatePath('/teacher/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-[#0B1426] text-white font-sans selection:bg-yellow-400 selection:text-black pb-20">
      
      {/* HEADER */}
      <header className="border-b border-white/10 bg-[#0B1426]/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/teacher/dashboard" className="text-slate-400 hover:text-yellow-400 transition-colors">
              <ArrowLeft size={24} />
            </Link>
            <div>
              <p className="text-[10px] font-black tracking-[0.2em] text-yellow-400 uppercase">System Identity</p>
              <h1 className="text-lg font-bold text-white">Operative Profile</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 mt-12">
        
        {/* PROFILE CARD */}
        <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden relative shadow-2xl">
          
          {/* BANNER BACKGROUND */}
          <div className="h-32 w-full bg-gradient-to-r from-yellow-400/20 via-[#0B1426] to-[#0B1426] border-b border-white/5 relative">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
          </div>

          {/* Background Decorative Icon */}
          <div className="absolute -right-10 top-20 opacity-[0.02] pointer-events-none">
            <Shield size={400} />
          </div>

          <div className="p-8 md:p-12 pt-0 relative z-10 flex flex-col md:flex-row gap-10 items-start">
            
            {/* AVATAR SECTION */}
            <div className="flex flex-col items-center gap-4 shrink-0 -mt-16">
              <div className="relative group cursor-pointer">
                <div className="w-32 h-32 bg-yellow-400 rounded-3xl flex items-center justify-center text-[#0B1426] font-black text-6xl shadow-[0_0_40px_rgba(250,204,21,0.2)] border-4 border-[#0B1426] transition-transform duration-300 group-hover:scale-105">
                  {userInitial}
                </div>
                {/* Camera Overlay for Future Image Uploads */}
                <div className="absolute inset-0 bg-[#0B1426]/60 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-sm border-4 border-[#0B1426]">
                  <Camera className="text-yellow-400" size={32} />
                </div>
                {/* Active Status Indicator */}
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-[#0B1426] rounded-full flex items-center justify-center">
                  <div className="w-5 h-5 bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                </div>
              </div>
              
              <div className="text-center mt-2 flex flex-col items-center gap-2">
                <h3 className="text-xl font-bold text-white">{currentName}</h3>
                <span className="bg-yellow-400/10 text-yellow-400 text-xs font-black uppercase tracking-widest px-4 py-1.5 rounded-lg border border-yellow-400/20 flex items-center gap-2">
                  <User size={14} />
                  User
                </span>
              </div>
            </div>

            {/* FORM SECTION */}
            <div className="flex-1 w-full pt-8 md:pt-4">
              <div className="flex items-center gap-3 mb-8 pb-4 border-b border-white/5">
                <User className="text-yellow-400" size={24} />
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">Identity Configurations</h2>
              </div>
              
              <form action={updateProfile} className="space-y-6 w-full max-w-md">
                
                {/* Full Name Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Official Designation
                  </label>
                  <div className="relative group">
                    <input 
                      type="text" 
                      name="fullName"
                      defaultValue={currentName}
                      placeholder="E.g. Akingbade"
                      required
                      className="w-full bg-[#0B1426]/50 border border-white/10 rounded-xl p-4 pl-12 text-white focus:border-yellow-400 focus:bg-white/5 focus:outline-none transition-all"
                    />
                    <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-yellow-400 transition-colors" />
                  </div>
                </div>

                {/* Email (Read Only) */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Registered Comms Channel</span>
                    <span className="flex items-center gap-1 text-[10px] text-green-400 bg-green-400/10 px-2 py-0.5 rounded border border-green-400/20">
                      <CheckCircle2 size={10} /> Verified
                    </span>
                  </label>
                  <div className="relative">
                    <input 
                      type="email" 
                      value={user.email}
                      disabled
                      className="w-full bg-[#0B1426]/80 border border-white/5 rounded-xl p-4 pl-12 pr-12 text-slate-500 cursor-not-allowed"
                    />
                    <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                    <Lock size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600" />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2 font-medium tracking-wide">Email addresses are permanently locked to the database row for security.</p>
                </div>

                {/* Submit Action */}
                <div className="pt-6">
                  <ProfileSubmitButton />
                </div>

              </form>
            </div>
          </div>
        </div>

      </main>
    </div>
  )
}