// Force Next.js to ALWAYS fetch fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Trophy, Medal, Users, Clock, Target, BarChart2, AlertCircle } from 'lucide-react'
import LiveRefresh from '@/components/LiveRefresh' 

// Helper to format seconds into "4m 12s"
function formatTime(totalSeconds: number) {
  if (!totalSeconds || totalSeconds === Infinity) return "--"
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}m ${s < 10 ? '0' : ''}${s}s`
}

export default async function ResultsPage({ 
  params 
}: { 
  params: Promise<{ quizId: string }> 
}) {
  // Await params for Next.js 15 compatibility
  const resolvedParams = await params;
  const targetQuizId = resolvedParams.quizId;

  const supabase = await createClient()
  
  // 1. Authenticate Teacher/Admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // 2. Fetch Quiz Details 
  // (RLS handles security here, so both the specific teacher AND admins can view it)
  const { data: quiz } = await supabase
    .from('quizzes')
    .select('title')
    .eq('id', targetQuizId)
    .single()

  if (!quiz) {
    return (
      <div className="min-h-screen bg-[#0B1426] text-white flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">Assessment Not Found</h1>
        <Link href="/teacher/quizzes" className="text-yellow-400 hover:underline">Return to Vault</Link>
      </div>
    )
  }

  // 3. Fetch from the V4 Schema Leaderboard View! 
  // This automatically joins the student's name and ranks them correctly.
  const { data: participants } = await supabase
    .from('v_quiz_leaderboard')
    .select('*')
    .eq('quiz_id', targetQuizId)
    .order('rank', { ascending: true })

  const safeParticipants = participants || []
  const totalParticipants = safeParticipants.length

  // 4. Calculate Real Analytics
  let averageScore = 0
  let fastestTime = Infinity
  let highestScore = 0

  if (totalParticipants > 0) {
    const totalScore = safeParticipants.reduce((acc, curr) => acc + Number(curr.score), 0)
    averageScore = Math.round(totalScore / totalParticipants)
    fastestTime = Math.min(...safeParticipants.map(p => p.time_taken_seconds))
    highestScore = Number(safeParticipants[0].score)
  }

  const winner = totalParticipants > 0 ? safeParticipants[0] : null

  return (
    <div className="min-h-screen bg-[#0B1426] text-white font-sans selection:bg-yellow-400 selection:text-black pb-20">
      
      {/* Silently updates the page every 3 seconds to show live results coming in */}
      <LiveRefresh intervalMs={3000} />

      {/* HEADER */}
      <header className="border-b border-white/10 bg-[#0B1426]/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-6 h-20 flex items-center gap-6">
          <Link href="/teacher/quizzes" className="text-slate-400 hover:text-yellow-400 transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <div>
            <p className="text-[10px] font-black tracking-[0.2em] text-yellow-400 uppercase line-clamp-1">{quiz.title}</p>
            <h1 className="text-lg font-bold text-white">Post-Mission Analytics</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 mt-8 space-y-8">
        
        {totalParticipants === 0 ? (
          /* EMPTY STATE: No one has taken the quiz yet */
          <div className="bg-white/5 border border-dashed border-white/20 rounded-3xl p-16 flex flex-col items-center justify-center text-center mt-10">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
              <AlertCircle className="text-yellow-400" size={40} />
            </div>
            <h2 className="text-2xl font-black text-white mb-2">Awaiting Intelligence</h2>
            <p className="text-slate-400 max-w-md mx-auto">
              No operatives have completed this assessment yet. Waiting for live data to stream in...
            </p>
          </div>
        ) : (
          <>
            {/* WINNER SPOTLIGHT */}
            {winner && (
              <div className="bg-gradient-to-br from-yellow-400/20 to-yellow-400/5 border border-yellow-400/30 rounded-3xl p-8 relative overflow-hidden flex items-center justify-between">
                <div className="absolute -right-10 -top-10 opacity-10">
                  <Trophy size={200} className="text-yellow-400" />
                </div>
                
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy size={18} className="text-yellow-400" />
                    <p className="text-xs font-bold text-yellow-400 uppercase tracking-widest">Top Operative</p>
                  </div>
                  <h2 className="text-4xl font-black text-white mb-1">{winner.student_name}</h2>
                  <div className="flex items-center gap-4 text-sm font-medium text-yellow-100">
                    <span className="flex items-center gap-1"><Target size={14} /> Score: {winner.score}%</span>
                    <span className="flex items-center gap-1"><Clock size={14} /> Time: {formatTime(winner.time_taken_seconds)}</span>
                  </div>
                </div>
                
                <div className="hidden sm:flex relative z-10 w-24 h-24 bg-yellow-400 rounded-full items-center justify-center text-[#0B1426] shadow-[0_0_30px_rgba(250,204,21,0.3)]">
                  <span className="text-4xl font-black">#1</span>
                </div>
              </div>
            )}

            {/* QUICK ANALYTICS GRID */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <BarChart2 size={20} className="text-slate-400 mb-3" />
                <p className="text-2xl font-bold text-white">{averageScore}%</p>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">Average</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <Users size={20} className="text-slate-400 mb-3" />
                <p className="text-2xl font-bold text-white">{totalParticipants}</p>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">Participants</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <Target size={20} className="text-slate-400 mb-3" />
                <p className="text-2xl font-bold text-white">{highestScore}%</p>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">Highest Score</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <Clock size={20} className="text-slate-400 mb-3" />
                <p className="text-2xl font-bold text-white">{formatTime(fastestTime)}</p>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">Fastest Clear</p>
              </div>
            </div>

            {/* LEADERBOARD TABLE */}
            <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
              <div className="p-6 border-b border-white/10 bg-white/5">
                <h3 className="text-lg font-black uppercase tracking-wide text-white flex items-center gap-2">
                  <Medal className="text-yellow-400" size={20} /> Live Leaderboard
                </h3>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-black/20 text-xs uppercase tracking-wider text-slate-500 font-bold">
                      <th className="p-4 pl-6 w-16">Rank</th>
                      <th className="p-4">Operative Name</th>
                      <th className="p-4 w-32">Score</th>
                      <th className="p-4 pr-6 w-32 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {safeParticipants.map((student, index) => {
                      const rank = index + 1
                      return (
                        <tr key={student.student_id} className={`transition-colors hover:bg-white/5 ${rank === 1 ? 'bg-yellow-400/5' : ''}`}>
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
                          <td className="p-4 font-bold text-white">
                            {student.student_name}
                            {rank === 1 && <span className="ml-2 text-xs text-yellow-400 font-black tracking-widest uppercase bg-yellow-400/10 px-2 py-1 rounded-md">Winner</span>}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden max-w-[80px]">
                                <div 
                                  className={`h-full rounded-full transition-all duration-1000 ${Number(student.score) >= 90 ? 'bg-yellow-400' : Number(student.score) >= 70 ? 'bg-green-400' : 'bg-red-400'}`} 
                                  style={{ width: `${student.score}%` }}
                                />
                              </div>
                              <span className="text-sm font-bold text-slate-300">{student.score}%</span>
                            </div>
                          </td>
                          <td className="p-4 pr-6 text-right font-medium text-slate-400 text-sm">
                            {formatTime(student.time_taken_seconds)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}