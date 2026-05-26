import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, UserPlus, Shield, Search, UserCheck } from 'lucide-react'
import { searchStudents, enrollStudent } from '../actions'

// NOTE: params and searchParams are now Promises in Next.js
export default async function ClassDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  // 1. Unwrap the params
  const { classId } = await params;
  const { q } = await searchParams;

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/admin/login')

  // 2. Fetch Class Data
  const { data: cls } = await supabase
    .from('classes')
    .select('*')
    .eq('id', classId)
    .single()

  if (!cls) redirect('/teacher/classes')

  // 3. Fetch Enrolled Students
  const { data: enrollments } = await supabase
    .from('class_enrollments')
    .select(`
      id,
      enrolled_at,
      profiles:student_id (id, full_name, avatar_url)
    `)
    .eq('class_id', classId)
    .order('enrolled_at', { ascending: false })

  // 4. Handle Search
  let searchResults = null
  if (q) {
    searchResults = await searchStudents(q)
  }

  return (
    <div className="min-h-screen bg-[#0B1426] text-white font-sans">
      <header className="border-b border-white/10 bg-[#0B1426]/80 backdrop-blur-md sticky top-0 z-20 px-6 h-20 flex items-center gap-4">
        <Link href="/teacher/classes" className="text-slate-400 hover:text-yellow-400 transition-colors">
          <ArrowLeft size={24} />
        </Link>
        <div>
          <p className="text-[10px] font-black tracking-[0.2em] text-yellow-400 uppercase">{cls.term} Term • {cls.academic_year}</p>
          <h1 className="text-lg font-bold text-white">{cls.name}</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 mt-8 space-y-8 pb-20">
        
        {/* ADD STUDENT SECTION - VISIBLY PROMINENT */}
        <div className="bg-gradient-to-br from-yellow-400/10 to-black border border-yellow-400/30 rounded-3xl p-8 shadow-[0_0_30px_rgba(250,204,21,0.05)]">
          <h2 className="text-2xl font-black uppercase tracking-wide text-white mb-6 flex items-center gap-3">
            <UserPlus className="text-yellow-400" size={28} /> Add Student to Class
          </h2>
          
          <form className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                name="q"
                defaultValue={q}
                placeholder="Search student by name..." 
                className="w-full bg-black/60 border border-white/20 rounded-xl py-4 pl-12 pr-4 text-white focus:border-yellow-400 outline-none focus:ring-1 focus:ring-yellow-400"
              />
            </div>
            <button type="submit" className="bg-yellow-400 text-black px-8 font-black rounded-xl hover:bg-yellow-300 transition-all">
              SEARCH
            </button>
          </form>

          {/* SEARCH RESULTS AREA */}
          {searchResults !== null && (
            <div className="mt-6 bg-black/40 border border-white/10 rounded-xl divide-y divide-white/5 p-2">
              {searchResults.length > 0 ? (
                searchResults.map((student) => (
                  <div key={student.id} className="flex items-center justify-between p-4 hover:bg-white/5 rounded-lg transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-yellow-400/20 rounded-full flex items-center justify-center text-yellow-400 font-bold">
                        {student.full_name?.charAt(0)}
                      </div>
                      <span className="font-bold text-white">{student.full_name}</span>
                    </div>
                    
                    <form action={async () => {
                      'use server'
                      await enrollStudent(classId, student.id)
                    }}>
                      <button type="submit" className="flex items-center gap-2 bg-white/10 hover:bg-yellow-400 hover:text-black font-bold px-4 py-2 rounded-lg transition-all">
                        <UserCheck size={16} /> Enroll
                      </button>
                    </form>
                  </div>
                ))
              ) : (
                <p className="p-4 text-slate-400 text-center">No students found with that name.</p>
              )}
            </div>
          )}
        </div>

        {/* ROSTER TABLE */}
        <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
          <div className="p-6 border-b border-white/10 bg-white/5">
            <h3 className="text-xl font-black text-white flex items-center gap-2">
              <Shield className="text-yellow-400" size={24} /> Class Roster ({enrollments?.length || 0})
            </h3>
          </div>
          <div className="divide-y divide-white/10">
            {enrollments?.length === 0 ? (
              <div className="p-10 text-center text-slate-500 italic">No students currently assigned to this unit.</div>
            ) : (
              enrollments?.map((enrollment: any) => (
                <div key={enrollment.id} className="flex items-center justify-between p-6">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center font-bold text-yellow-400">
                      {enrollment.profiles.full_name?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-lg text-white">{enrollment.profiles.full_name}</p>
                      <p className="text-xs text-slate-500 font-mono">ID: {enrollment.profiles.id.slice(0, 8)}...</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  )
}