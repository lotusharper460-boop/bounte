// Force Next.js to ALWAYS fetch fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Trophy, Target, Clock, Zap, LogOut, ChevronRight, Timer, ShieldCheck, Users, CheckCircle2, Bell, XCircle } from 'lucide-react'
import { logoutAction } from '@/app/actions/auth'

function getTimeRemaining(deadline: string | null) {
  if (!deadline) return "No Deadline"
  const now = new Date().getTime()
  const end = new Date(deadline).getTime()
  const diff = end - now
  if (diff <= 0) return "Expired"
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
  const mins = Math.floor((diff / 1000 / 60) % 60)
  if (days > 0) return `Ends in ${days}d ${hours}h`
  if (hours > 0) return `Ends in ${hours}h ${mins}m`
  return `Ends in ${mins}m`
}

export default async function StudentDashboard() {
  const supabase = await createClient()

  // 1. Authenticate & Secure the Route
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // 2. Fetch Student Profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const studentName = profile?.full_name || 'Operative'

  // 3. Fetch Submissions (to mark completed missions)
  const { data: submissions } = await supabase
    .from('submissions')
    .select('quiz_id')
    .eq('student_id', user.id)

  const completedQuizIds = new Set<string>()
  if (submissions) {
    submissions.forEach(sub => {
      if (sub.quiz_id) completedQuizIds.add(sub.quiz_id)
    })
  }

  // 4. Fetch Enrolled Classes
  const { data: enrollments } = await supabase
    .from('class_enrollments')
    .select('class_id')
    .eq('student_id', user.id)

  const enrolledClassIds = enrollments?.map(e => e.class_id) || []

  // 5. Fetch Campaigns
  const { data: rawCampaigns } = await supabase
    .from('quizzes')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(50)

  // 6. Filter and Tag Campaigns
  const displayCampaigns = (rawCampaigns || []).reduce((acc: any[], campaign: any) => {
    const isCompleted = completedQuizIds.has(campaign.id);
    const isExpired = campaign.deadline && new Date(campaign.deadline).getTime() <= new Date().getTime();
    const isGlobal = !campaign.class_id;
    const isEnrolled = enrolledClassIds.includes(campaign.class_id);

    if (!isGlobal && !isEnrolled) return acc;
    const isMissed = isExpired && !isCompleted;
    acc.push({ ...campaign, isCompleted, isExpired, isMissed });
    return acc;
  }, [] as any[]);

  // ------------------------------------------------------------
  // 7. CLASS LEADERBOARD (secure RPC)
  // ------------------------------------------------------------
  let finalLeaderboard: any[] = [];
  let totalBounties = 0;

  if (enrolledClassIds.length > 0) {
    const primaryClassId = enrolledClassIds[0];

    // Use the SECURITY DEFINER function to bypass RLS
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'get_class_leaderboard_secure',
      { target_class_id: primaryClassId }
    );

    if (!rpcError && rpcData) {
      finalLeaderboard = rpcData;
    } // else remains empty

    const myEntry = finalLeaderboard.find((s: any) => s.student_id === user.id);
    totalBounties = myEntry ? myEntry.total_points : 0;
  }

  // Build ranking (1‑indexed)
  const rankedLeaderboard = finalLeaderboard.map((student: any, index: number) => ({
    ...student,
    displayRank: index + 1,
  }));

  let currentUserEntry = rankedLeaderboard.find(s => s.student_id === user.id);

  // Fallback if student not in class (shouldn't happen)
  if (!currentUserEntry && enrolledClassIds.length > 0) {
    currentUserEntry = {
      student_id: user.id,
      full_name: studentName,
      total_points: totalBounties,
      displayRank: rankedLeaderboard.length > 0
        ? rankedLeaderboard[rankedLeaderboard.length - 1].displayRank + 1
        : 1,
    };
  }

  // Top 10 + pin current user if outside top 10
  const displayBoard = rankedLeaderboard.slice(0, 10);
  if (currentUserEntry && !displayBoard.some(s => s.student_id === user.id)) {
    displayBoard.push({ ...currentUserEntry, isPinned: true });
  }

  // ------------------------------------------------------------
  // RENDER
  // ------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#0B1426] text-white font-sans selection:bg-yellow-400 selection:text-black pb-20">
      
      <header className="border-b border-white/10 bg-[#0B1426]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center text-[#0B1426] font-black">
              {studentName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-[10px] font-black tracking-[0.2em] text-yellow-400 uppercase">Operative Profile</p>
              <h1 className="text-sm font-bold text-white">{studentName}</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <Link href="/student/announcements" className="relative text-slate-400 hover:text-yellow-400 transition-colors flex items-center gap-2 group">
              <div className="relative bg-white/5 p-2 rounded-full border border-white/10 group-hover:border-yellow-400/50 transition-all">
                <Bell size={16} />
                <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              </div>
              <span className="text-xs font-bold hidden sm:block uppercase tracking-wider">Comms</span>
            </Link>

            <div className="w-px h-6 bg-white/10"></div>

            <form action={logoutAction}>
              <button className="text-xs font-bold text-slate-400 hover:text-yellow-400 transition-colors flex items-center gap-2">
                <LogOut size={14} /> <span className="hidden sm:inline">Disconnect</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: MISSIONS */}
        <div className="lg:col-span-2 space-y-8">
          
          <div className="bg-gradient-to-br from-yellow-400/20 to-[#0B1426] border border-yellow-400/30 rounded-3xl p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 relative overflow-hidden">
            <div className="absolute -right-10 -top-10 opacity-10 pointer-events-none">
              <Trophy size={200} className="text-yellow-400" />
            </div>
            <div className="relative z-10">
              <p className="text-sm font-bold text-yellow-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                <Zap size={16} /> Total Yield Accumulated
              </p>
              <h2 className="text-5xl sm:text-6xl font-black text-white">{totalBounties.toLocaleString()} <span className="text-2xl text-slate-400">BP</span></h2>
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <h3 className="text-2xl font-black uppercase tracking-wide text-white">Active Campaigns</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {displayCampaigns.map((campaign: any) => {
              const isInactive = campaign.isCompleted || campaign.isMissed;
              
              return (
                <Link href={`/student/campaign/${campaign.id}`} key={campaign.id} className="group block">
                  <div className={`border rounded-2xl p-6 transition-all relative overflow-hidden h-full flex flex-col shadow-lg ${isInactive ? 'bg-[#0B1426] border-white/5 opacity-80 hover:opacity-100 hover:border-slate-500/30' : 'bg-white/5 border-white/10 hover:border-yellow-400/50 hover:bg-white/[0.08]'}`}>
                    
                    <div className="flex justify-between items-start mb-6">
                      <div className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest border flex items-center gap-1.5 ${isInactive ? 'bg-slate-500/10 text-slate-400 border-slate-500/20' : 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20'}`}>
                        <Zap size={14} /> {campaign.reward_value} {campaign.reward_type === 'Bounty Points' ? 'BP' : 'RWD'}
                      </div>
                      
                      {campaign.isCompleted ? (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2 py-1.5 rounded-lg border border-emerald-400/20">
                          <CheckCircle2 size={12} /> Done
                        </div>
                      ) : campaign.isMissed ? (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-red-400 bg-red-400/10 px-2 py-1.5 rounded-lg border border-red-400/20">
                          <XCircle size={12} /> Missed
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-yellow-400 bg-yellow-400/10 px-2 py-1.5 rounded-lg border border-yellow-400/20">
                          <ShieldCheck size={12} /> Live
                        </div>
                      )}
                    </div>

                    <div className="mb-4">
                      {campaign.class_id ? (
                         <span className={`inline-block px-2 py-1 text-[10px] font-black uppercase tracking-wider rounded border mb-2 ${isInactive ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>Class Assessment</span>
                      ) : (
                         <span className={`inline-block px-2 py-1 text-[10px] font-black uppercase tracking-wider rounded border mb-2 ${isInactive ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'}`}>Global Mission</span>
                      )}
                      <h4 className={`text-xl font-bold line-clamp-2 ${isInactive ? 'text-slate-400' : 'text-white'}`}>{campaign.title}</h4>
                    </div>
                    
                    <div className="space-y-3 mt-auto mb-6">
                      <div className="flex items-center gap-2 text-sm text-slate-400 font-medium">
                        <Clock size={16} className="text-slate-500" /> Time Limit: {campaign.time_limit}m
                      </div>
                      {(!campaign.isCompleted && !campaign.isMissed) && (
                        <div className="flex items-center gap-2 text-sm text-yellow-400/80 font-bold bg-yellow-400/5 w-fit px-2 py-1 rounded border border-yellow-400/10">
                          <Timer size={16} className="text-yellow-400/70" /> {getTimeRemaining(campaign.deadline)}
                        </div>
                      )}
                      {campaign.isMissed && (
                         <div className="flex items-center gap-2 text-sm text-red-400/80 font-bold bg-red-400/5 w-fit px-2 py-1 rounded border border-red-400/10">
                         <Timer size={16} className="text-red-400/70" /> Expired
                       </div>
                      )}
                    </div>

                    <div className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                      campaign.isCompleted 
                        ? 'bg-white/5 text-slate-300 group-hover:bg-emerald-500/20 group-hover:text-emerald-400' 
                        : campaign.isMissed
                        ? 'bg-white/5 text-slate-400 group-hover:bg-red-500/20 group-hover:text-red-400'
                        : 'bg-white/5 group-hover:bg-yellow-400 group-hover:text-[#0B1426] text-white'
                    }`}>
                      {campaign.isCompleted 
                        ? 'View Leaderboard' 
                        : campaign.isMissed 
                        ? 'Missed - View Ranks' 
                        : 'Enter Mission'} 
                      <ChevronRight size={16} />
                    </div>
                  </div>
                </Link>
              );
            })}

            {displayCampaigns.length === 0 && (
              <div className="col-span-full py-16 text-center border border-dashed border-white/10 rounded-3xl bg-white/5 flex flex-col items-center">
                <Target size={48} className="text-slate-600 mb-4" />
                <p className="text-slate-400 font-medium text-lg">No active campaigns available.</p>
                <p className="text-slate-500 text-sm mt-2">Stand by for new operations to be deployed.</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: CLASS LEADERBOARD */}
        <div className="lg:col-span-1">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl sticky top-28 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-black uppercase tracking-widest text-white flex items-center gap-2">
                <Users size={18} className="text-yellow-400" /> Class Leaderboard
              </h3>
            </div>

            <div className="space-y-3">
              {displayBoard.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">
                  {enrolledClassIds.length === 0
                    ? 'You are not enrolled in any class yet.'
                    : 'No rankings yet. Be the first to earn points!'}
                </div>
              ) : (
                displayBoard.map((student: any) => {
                  const isPinned = student.isPinned;
                  const rank = student.displayRank;

                  return (
                    <div key={`student-${student.student_id}`} className="flex flex-col">
                      
                      {isPinned && (
                        <div className="flex justify-center py-2 mb-1">
                          <div className="flex gap-2">
                            <div className="w-1.5 h-1.5 bg-white/10 rounded-full"></div>
                            <div className="w-1.5 h-1.5 bg-white/10 rounded-full"></div>
                            <div className="w-1.5 h-1.5 bg-white/10 rounded-full"></div>
                          </div>
                        </div>
                      )}
                      
                      <div className={`flex items-center justify-between p-3 rounded-xl border ${student.student_id === user.id ? 'bg-yellow-400/10 border-yellow-400/30' : 'bg-[#0B1426]/30 border-white/5'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-black ${
                            rank === 1 ? 'bg-yellow-400 text-black shadow-[0_0_10px_rgba(250,204,21,0.3)]' : 
                            rank === 2 ? 'bg-slate-300 text-black' : 
                            rank === 3 ? 'bg-amber-700 text-white' : 
                            'bg-white/5 text-slate-400 border border-white/10'
                          }`}>
                            {rank}
                          </div>
                          <span className={`text-sm font-bold truncate max-w-[120px] ${student.student_id === user.id ? 'text-yellow-400' : 'text-white'}`}>
                            {student.student_id === user.id ? 'You' : student.full_name || 'Operative'}
                          </span>
                        </div>
                        <div className="text-sm font-black text-slate-300">
                          {student.total_points} <span className="text-[10px] text-slate-500">BP</span>
                        </div>
                      </div>
                      
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </main>
    </div>
  )
}