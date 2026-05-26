// Force Next.js to ALWAYS fetch fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Trophy, Medal, Users, ArrowLeft, BarChart2, Target, Zap } from 'lucide-react'
import ClassSelector from './ClassSelector'

export default async function TeacherClassLeaderboard(props: {
  searchParams: Promise<{ classId?: string }>
}) {
  const searchParams = await props.searchParams
  const supabase = await createClient()

  // 1. Authenticate teacher/admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // 2. Fetch teacher’s own classes
  const { data: myClasses } = await supabase
    .from('classes')
    .select('id, name')
    .eq('teacher_id', user.id)
    .order('name', { ascending: true })

  if (!myClasses || myClasses.length === 0) {
    return (
      <div className="min-h-screen bg-[#0B1426] text-white flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">No Classes Found</h1>
        <p className="text-slate-400">You are not assigned to any class yet.</p>
      </div>
    )
  }

  // Determine selected class (from search param or first class)
  const selectedClassId = searchParams.classId || myClasses[0].id
  const selectedClass = myClasses.find(c => c.id === selectedClassId) || myClasses[0]

  // 3. Get cumulative leaderboard for that class using the secure function
  const { data: leaderboardData, error } = await supabase.rpc(
    'get_class_leaderboard_secure',
    { target_class_id: selectedClassId }
  )

  const leaderboard = (leaderboardData || []) as any[]
  const totalStudents = leaderboard.length
  let highestPoints = 0
  let averagePoints = 0

  if (totalStudents > 0) {
    highestPoints = leaderboard[0]?.total_points || 0
    const sum = leaderboard.reduce((acc, s) => acc + Number(s.total_points), 0)
    averagePoints = Math.round(sum / totalStudents)
  }

  const topOperative = totalStudents > 0 ? leaderboard[0] : null

  return (
    <div className="min-h-screen bg-[#0B1426] text-white font-sans selection:bg-yellow-400 selection:text-black pb-20">
      
      {/* HEADER */}
      <header className="border-b border-white/10 bg-[#0B1426]/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center gap-6">
          <Link href="/teacher/quizzes" className="text-slate-400 hover:text-yellow-400 transition-colors">
            <ArrowLeft size={24} />
          </Link>
          <div className="flex-1">
            <p className="text-[10px] font-black tracking-[0.2em] text-yellow-400 uppercase">
              Class Bounty Overview
            </p>
            <h1 className="text-lg font-bold text-white">{selectedClass.name}</h1>
          </div>

          {/* Class selector client component */}
          <ClassSelector classes={myClasses} selectedClassId={selectedClassId} />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 mt-8 space-y-8">
        
        {totalStudents === 0 ? (
          <div className="bg-white/5 border border-dashed border-white/20 rounded-3xl p-16 flex flex-col items-center justify-center text-center mt-10">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
              <Users className="text-yellow-400" size={40} />
            </div>
            <h2 className="text-2xl font-black text-white mb-2">No Students Yet</h2>
            <p className="text-slate-400 max-w-md mx-auto">
              This class has no enrolled students or no bounty points have been earned.
            </p>
          </div>
        ) : (
          <>
            {/* TOP OPERATIVE SPOTLIGHT */}
            {topOperative && (
              <div className="bg-gradient-to-br from-yellow-400/20 to-yellow-400/5 border border-yellow-400/30 rounded-3xl p-8 relative overflow-hidden flex items-center justify-between">
                <div className="absolute -right-10 -top-10 opacity-10">
                  <Trophy size={200} className="text-yellow-400" />
                </div>
                
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy size={18} className="text-yellow-400" />
                    <p className="text-xs font-bold text-yellow-400 uppercase tracking-widest">Top Operative</p>
                  </div>
                  <h2 className="text-4xl font-black text-white mb-1">{topOperative.full_name}</h2>
                  <div className="flex items-center gap-4 text-sm font-medium text-yellow-100">
                    <span className="flex items-center gap-1">
                      <Zap size={14} /> {topOperative.total_points} Bounty Points
                    </span>
                  </div>
                </div>
                
                <div className="hidden sm:flex relative z-10 w-24 h-24 bg-yellow-400 rounded-full items-center justify-center text-[#0B1426] shadow-[0_0_30px_rgba(250,204,21,0.3)]">
                  <span className="text-4xl font-black">#1</span>
                </div>
              </div>
            )}

            {/* AGGREGATE STATS */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <Users size={20} className="text-slate-400 mb-3" />
                <p className="text-2xl font-bold text-white">{totalStudents}</p>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">Students</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <BarChart2 size={20} className="text-slate-400 mb-3" />
                <p className="text-2xl font-bold text-white">{averagePoints}</p>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">Avg Points</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <Trophy size={20} className="text-slate-400 mb-3" />
                <p className="text-2xl font-bold text-white">{highestPoints}</p>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">Highest Points</p>
              </div>
            </div>

            {/* LEADERBOARD TABLE */}
            <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
              <div className="p-6 border-b border-white/10 bg-white/5">
                <h3 className="text-lg font-black uppercase tracking-wide text-white flex items-center gap-2">
                  <Medal className="text-yellow-400" size={20} /> Cumulative Leaderboard
                </h3>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-black/20 text-xs uppercase tracking-wider text-slate-500 font-bold">
                      <th className="p-4 pl-6 w-16">Rank</th>
                      <th className="p-4">Operative Name</th>
                      <th className="p-4 pr-6 w-32 text-right">Bounty Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {leaderboard.map((student, index) => {
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
                            {student.full_name}
                            {rank === 1 && <span className="ml-2 text-xs text-yellow-400 font-black tracking-widest uppercase bg-yellow-400/10 px-2 py-1 rounded-md">Top Operative</span>}
                          </td>
                          <td className="p-4 pr-6 text-right font-medium text-slate-300 text-sm">
                            {student.total_points} BP
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