// Force Next.js to ALWAYS fetch fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
// ADDED Trophy to imports
import { PlusCircle, BarChart3, Users, LogOut, ChevronRight, MessageSquare, Bell, Trophy } from 'lucide-react'
import { logoutAction } from '@/app/actions/auth'

export default async function TeacherDashboard() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/auth/admin/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const fullName = profile?.full_name || 'Proprietor'
  const userInitial = fullName.charAt(0).toUpperCase()

  return (
    <div className="min-h-screen bg-[#0B1426] text-white font-sans selection:bg-yellow-400 selection:text-black pb-20">
      
      {/* HEADER SECTION */}
      <header className="border-b border-white/10 bg-[#0B1426]/50 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          
          {/* INTERACTIVE PROFILE BUTTON AREA */}
          <Link 
            href="/teacher/profile" 
            className="group flex items-center gap-3 p-1 pr-3 rounded-xl hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
          >
            <div className="w-10 h-10 shrink-0 bg-yellow-400 rounded-lg flex items-center justify-center text-[#0B1426] font-black group-hover:shadow-[0_0_15px_rgba(250,204,21,0.4)] transition-shadow">
              {userInitial}
            </div>
            <div className="hidden sm:block">
              <p className="text-[10px] font-black tracking-[0.2em] text-yellow-400 uppercase">User Profile</p>
              <h1 className="text-sm font-bold text-white/90 group-hover:text-white transition-colors">{fullName}</h1>
            </div>
          </Link>

          {/* COMMS AND LOGOUT AREA */}
          <div className="flex items-center gap-4 sm:gap-6">
            
            {/* NEW: ANNOUNCEMENT BROADCAST BELL */}
            <Link href="/teacher/announcements" className="relative text-slate-400 hover:text-yellow-400 transition-colors flex items-center gap-2 group">
              <div className="relative bg-white/5 p-2 rounded-full border border-white/10 group-hover:border-yellow-400/50 transition-all">
                <Bell size={18} />
              </div>
              <span className="text-xs font-bold hidden sm:block uppercase tracking-wider">Broadcast</span>
            </Link>

            <div className="w-px h-6 bg-white/10"></div>

            <form action={logoutAction}>
              <button className="group flex items-center justify-center sm:gap-2 p-2 sm:px-4 sm:py-2 text-xs font-bold text-slate-400 hover:text-yellow-400 transition-colors bg-white/5 sm:bg-transparent rounded-lg sm:rounded-none active:scale-95">
                <LogOut size={18} className="sm:w-[14px] sm:h-[14px] group-hover:-translate-x-1 transition-transform" />
                <span className="hidden sm:block">TERMINATE SESSION</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        
        {/* PAGE TITLE */}
        <div className="mb-12">
          <h2 className="text-4xl font-black text-white tracking-tight mb-2">
            Control Panel
          </h2>
          <div className="h-1 w-20 bg-yellow-400"></div>
        </div>

        {/* CARDS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Card 1: Classrooms */}
          <Link href="/teacher/classes" className="group">
            <div className="h-full bg-white/5 border border-white/10 p-8 rounded-2xl hover:border-yellow-400/50 hover:bg-white/[0.08] transition-all relative overflow-hidden active:scale-[0.98]">
              <div className="relative z-10">
                <Users className="text-yellow-400 mb-6" size={32} />
                <h3 className="text-xl font-black text-white mb-3 uppercase tracking-tight">Classroom Deployments</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  Initialize new class groups, recruit student operatives, and manage active academic rosters.
                </p>
                <div className="flex items-center gap-2 text-yellow-400 text-xs font-black tracking-widest uppercase">
                  Manage Rosters <ChevronRight size={14} />
                </div>
              </div>
            </div>
          </Link>

          {/* Card 2: Assessment Initialization */}
          <Link href="/teacher/quiz/new" className="group">
            <div className="h-full bg-white/5 border border-white/10 p-8 rounded-2xl hover:border-yellow-400/50 hover:bg-white/[0.08] transition-all relative overflow-hidden active:scale-[0.98]">
              <div className="relative z-10">
                <PlusCircle className="text-yellow-400 mb-6" size={32} />
                <h3 className="text-xl font-black text-white mb-3 uppercase tracking-tight">Initialize Assessment</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  Upload formatted CBT documents for automated AI extraction, or configure custom assessment parameters manually.
                </p>
                <div className="flex items-center gap-2 text-yellow-400 text-xs font-black tracking-widest uppercase">
                  Launch Engine <ChevronRight size={14} />
                </div>
              </div>
            </div>
          </Link>

          {/* Card 3: AI Message Drafter */}
          <Link href="/teacher/ai-generator" className="group">
            <div className="h-full bg-white/5 border border-white/10 p-8 rounded-2xl hover:border-yellow-400/50 hover:bg-white/[0.08] transition-all relative overflow-hidden active:scale-[0.98]">
              <div className="relative z-10">
                <MessageSquare className="text-yellow-400 mb-6" size={32} />
                <h3 className="text-xl font-black text-white mb-3 uppercase tracking-tight">AI Comms Assistant</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  Deploy artificial intelligence to instantly draft professional fee reminders, newsletters, and PTA announcements.
                </p>
                <div className="flex items-center gap-2 text-yellow-400 text-xs font-black tracking-widest uppercase">
                  Open Channel <ChevronRight size={14} />
                </div>
              </div>
            </div>
          </Link>

          {/* Card 4: View Results */}
          <Link href="/teacher/quizzes" className="group">
            <div className="h-full bg-white/5 border border-white/10 p-8 rounded-2xl hover:border-yellow-400/50 hover:bg-white/[0.08] transition-all relative overflow-hidden active:scale-[0.98]">
              <div className="relative z-10">
                <BarChart3 className="text-yellow-400 mb-6" size={32} />
                <h3 className="text-xl font-black text-white mb-3 uppercase tracking-tight">Data Analytics</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  Review student performance metrics, class averages, and official historical assessment data from the vault.
                </p>
                <div className="flex items-center gap-2 text-yellow-400 text-xs font-black tracking-widest uppercase">
                  Access Data <ChevronRight size={14} />
                </div>
              </div>
            </div>
          </Link>

          {/* NEW CARD: Class Bounty Leaderboard */}
          <Link href="/teacher/class-leaderboard" className="group">
            <div className="h-full bg-white/5 border border-white/10 p-8 rounded-2xl hover:border-yellow-400/50 hover:bg-white/[0.08] transition-all relative overflow-hidden active:scale-[0.98]">
              <div className="relative z-10">
                <Trophy className="text-yellow-400 mb-6" size={32} />
                <h3 className="text-xl font-black text-white mb-3 uppercase tracking-tight">Class Leaderboard</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  View cumulative bounty points and overall ranking for each class you manage.
                </p>
                <div className="flex items-center gap-2 text-yellow-400 text-xs font-black tracking-widest uppercase">
                  View Rankings <ChevronRight size={14} />
                </div>
              </div>
            </div>
          </Link>

        </div>
      </main>
    </div>
  )
}