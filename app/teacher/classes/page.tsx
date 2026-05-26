import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Users, BookOpen, Calendar } from 'lucide-react'
import { createClass } from './actions'

export default async function ClassesHubPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/admin/login')

  // Fetch classes owned by this teacher
  const { data: classes } = await supabase
    .from('classes')
    .select('*')
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-[#0B1426] text-white font-sans selection:bg-yellow-400 selection:text-black pb-20">
      <header className="border-b border-white/10 bg-[#0B1426]/80 backdrop-blur-md sticky top-0 z-20 px-6 h-20 flex items-center">
        <div className="max-w-6xl mx-auto w-full flex justify-between items-center">
          <h1 className="text-xl font-bold text-white">Classrooms</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: Create Class Form */}
        <div className="lg:col-span-1">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 sticky top-28">
            <h2 className="text-lg font-black tracking-wide uppercase text-yellow-400 mb-6 flex items-center gap-2">
              <Plus size={18} /> Deploy New Class
            </h2>
            
            <form action={createClass} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Class Name</label>
                <input required type="text" name="name" placeholder="e.g. Advanced Physics 101" className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-yellow-400 focus:outline-none transition-colors" />
              </div>
              
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Subject</label>
                <input required type="text" name="subject" placeholder="e.g. Science" className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-yellow-400 focus:outline-none transition-colors" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Academic Year</label>
                  <input required type="text" name="academic_year" placeholder="2025/2026" className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-yellow-400 focus:outline-none transition-colors" />
                </div>
                
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Term</label>
                  {/* CRITICAL: Must be a select dropdown to satisfy database ENUM */}
                  <select required name="term" className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-yellow-400 focus:outline-none transition-colors appearance-none">
                    <option value="1st">1st Term</option>
                    <option value="2nd">2nd Term</option>
                    <option value="3rd">3rd Term</option>
                  </select>
                </div>
              </div>

              <button type="submit" className="w-full bg-yellow-400 text-[#0B1426] font-black uppercase tracking-widest py-4 rounded-xl hover:bg-yellow-300 transition-colors mt-4">
                Initialize Class
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: Active Classes Grid */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-bold text-white mb-4">Active Deployments</h2>
          
          {classes?.length === 0 ? (
             <div className="bg-white/5 border border-dashed border-white/20 rounded-2xl p-10 text-center">
               <p className="text-slate-400">No classes initialized yet. Create one to begin.</p>
             </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {classes?.map((cls) => (
                <Link key={cls.id} href={`/teacher/classes/${cls.id}`}>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 hover:border-yellow-400/50 transition-all cursor-pointer group">
                    <h3 className="text-xl font-bold text-white mb-2 group-hover:text-yellow-400 transition-colors">{cls.name}</h3>
                    <div className="space-y-2">
                      <p className="text-sm text-slate-400 flex items-center gap-2"><BookOpen size={14}/> {cls.subject}</p>
                      <p className="text-sm text-slate-400 flex items-center gap-2"><Calendar size={14}/> {cls.term} Term, {cls.academic_year}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}