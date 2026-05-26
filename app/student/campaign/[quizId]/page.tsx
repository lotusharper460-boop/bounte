// Force Next.js to ALWAYS fetch fresh data for the live leaderboard
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Trophy, Clock, Target, Users, Medal, Zap, Timer, Lock } from 'lucide-react'

// Helper to format seconds for the leaderboard
function formatTime(totalSeconds: number) {
  if (!totalSeconds || totalSeconds === Infinity) return "--"
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}m ${s < 10 ? '0' : ''}${s}s`
}

// Helper to calculate the countdown to expiration
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

export default async function CampaignInfoPage({ 
  params 
}: { 
  params: Promise<{ quizId: string }> 
}) {
  // ✅ NEXT.JS 15 FIX: We must await the params promise first!
  const resolvedParams = await params;
  const targetQuizId = resolvedParams.quizId;

  const supabase = await createClient()

  // 1. Gateway Check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/auth/register?redirectTo=/student/campaign/${targetQuizId}`)
  }

  // 2. Fetch Campaign Details using the resolved ID
  const { data: quiz, error: quizError } = await supabase
    .from('quizzes')
    .select('*')
    .eq('id', targetQuizId)
    .single()

  if (quizError || !quiz) {
    return (
      <div className="min-h-screen bg-[#0B1426] text-white flex flex-col justify-center items-center">
        <h1 className="text-2xl font-black text-red-400 mb-4">404 - Campaign Not Found</h1>
        <p className="text-slate-400 mb-8">The database could not locate this mission.</p>
        <Link href="/student/dashboard" className="px-6 py-3 bg-white/10 rounded-xl hover:bg-white/20 transition-colors">
          Return to Dashboard
        </Link>
      </div>
    )
  }

  // Security Check: Has the deadline passed?
  const isExpired = quiz.deadline && new Date(quiz.deadline).getTime() <= new Date().getTime()

  // 3. SECURE LEADERBOARD FETCH
  // Bypasses RLS strictly to fetch the ranked scores and times
  const { data: submissions, error: submissionsError } = await supabase
    .rpc('get_campaign_leaderboard', { target_quiz_id: quiz.id })

  const participants = submissions || []
  
  // 4. Identify User Status using strict ID matching
  const hasCompleted = participants.some((sub: any) => sub.student_id === user.id)
  const mySubmission = participants.find((sub: any) => sub.student_id === user.id)

  return (
    <div className="min-h-screen bg-[#0B1426] text-white font-sans selection:bg-yellow-400 selection:text-black pb-20">
      
      {/* HEADER */}
      <header className="border-b border-white/10 bg-[#0B1426]/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-6 h-20 flex items-center gap-6">
          <Link href="/student/dashboard" className="text-slate-400 hover:text-yellow-400 transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <div>
            <p className="text-[10px] font-black tracking-[0.2em] text-yellow-400 uppercase">Campaign Dossier</p>
            <h1 className="text-lg font-bold text-white line-clamp-1">{quiz.title}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 mt-8 space-y-8">
        
        {/* HERO SECTION */}
        <div className="bg-gradient-to-br from-[#0B1426] to-[#121E36] border border-white/10 rounded-3xl p-8 md:p-12 relative overflow-hidden shadow-2xl">
          <div className="absolute -right-20 -top-20 opacity-[0.03] pointer-events-none">
            <Target size={400} />
          </div>

          <div className="relative z-10 flex flex-col md:flex-row gap-10 items-center justify-between">
            <div className="flex-1">
              <div className="flex gap-3 mb-6">
                <div className="inline-flex bg-yellow-400/10 text-yellow-400 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest border border-yellow-400/20">
                  Active Bounty
                </div>
                {/* Visual Countdown Badge */}
                <div className={`inline-flex px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest border flex items-center gap-1.5 ${isExpired ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-white/5 text-slate-300 border-white/10'}`}>
                  <Timer size={14} /> {getTimeRemaining(quiz.deadline)}
                </div>
              </div>

              <h2 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">{quiz.title}</h2>
              <div className="flex flex-wrap gap-4 text-sm font-medium text-slate-300 mb-8">
                <span className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/10"><Clock size={16} className="text-yellow-400"/> {quiz.time_limit} Minutes</span>
                <span className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/10"><Trophy size={16} className="text-yellow-400"/> {quiz.reward_value} {quiz.reward_type}</span>
                <span className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/10"><Users size={16} className="text-yellow-400"/> {participants.length} Engaged</span>
              </div>
            </div>

            {/* DYNAMIC CALL TO ACTION BUTTON */}
            <div className="w-full md:w-auto shrink-0 flex flex-col items-center">
              {hasCompleted ? (
                <div className="w-full bg-green-500/10 border border-green-500/30 rounded-2xl p-6 text-center shadow-[0_0_30px_rgba(34,197,94,0.1)]">
                  <p className="text-xs font-black text-green-400 uppercase tracking-widest mb-2">Mission Cleared</p>
                  <p className="text-4xl font-black text-white mb-1">{mySubmission?.score}%</p>
                  <p className="text-sm text-slate-400">in {formatTime(mySubmission?.time_taken_seconds || 0)}</p>
                </div>
              ) : isExpired ? (
                <div className="w-full md:w-64 py-5 bg-white/5 text-slate-500 border border-dashed border-white/10 rounded-2xl font-black text-lg uppercase tracking-widest text-center flex items-center justify-center gap-3 cursor-not-allowed">
                  <Lock size={20} /> Expired
                </div>
              ) : (
                <Link 
                  href={`/student/quiz/${quiz.id}`} 
                  className="w-full relative group"
                >
                  <div className="absolute -inset-1 bg-gradient-to-r from-yellow-400 to-amber-600 rounded-2xl blur opacity-30 group-hover:opacity-70 transition duration-500"></div>
                  <div className="relative w-full md:w-64 py-5 bg-yellow-400 text-[#0B1426] rounded-2xl font-black text-lg uppercase tracking-widest text-center hover:bg-yellow-300 active:scale-95 transition-all flex items-center justify-center gap-3">
                    <Zap size={20} /> Initiate
                  </div>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* LIVE LEADERBOARD */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-black uppercase tracking-wide text-white flex items-center gap-2">
              <Medal className="text-yellow-400" size={20} /> Live Standings
            </h3>
          </div>

          {participants.length === 0 ? (
            <div className="bg-white/5 border border-dashed border-white/20 rounded-2xl p-12 text-center">
              <p className="text-slate-400 font-medium">No operatives have cleared this mission yet. Be the first to claim the bounty.</p>
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-black/20 text-xs uppercase tracking-wider text-slate-500 font-bold">
                      <th className="p-4 pl-6 w-16">Rank</th>
                      <th className="p-4">Operative</th>
                      <th className="p-4 w-32">Score</th>
                      <th className="p-4 pr-6 w-32 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {participants.map((p: any, index: number) => {
                      const rank = index + 1
                      const isMe = p.student_id === user.id

                      return (
                        <tr key={p.id} className={`transition-colors hover:bg-white/5 ${isMe ? 'bg-yellow-400/5' : ''}`}>
                          <td className="p-4 pl-6">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm ${
                              rank === 1 ? 'bg-yellow-400 text-[#0B1426]' : 
                              rank === 2 ? 'bg-slate-300 text-[#0B1426]' :
                              rank === 3 ? 'bg-amber-600 text-white' :
                              'bg-white/10 text-slate-400'
                            }`}>
                              {rank}
                            </div>
                          </td>
                          <td className="p-4 font-bold text-white flex items-center gap-3">
                            {p.student_name}
                            {isMe && <span className="text-[10px] bg-yellow-400/20 text-yellow-400 px-2 py-0.5 rounded uppercase tracking-wider border border-yellow-400/30">You</span>}
                          </td>
                          <td className="p-4 font-bold text-yellow-400">
                            {p.score}%
                          </td>
                          <td className="p-4 pr-6 text-right font-medium text-slate-400 text-sm">
                            {formatTime(p.time_taken_seconds)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

      </main>
    </div>
  )
}