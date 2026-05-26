export const dynamic = 'force-dynamic'
export const revalidate = 0

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Bell, Radio, CalendarDays, UserSquare2, ShieldAlert } from 'lucide-react'

export default async function StudentAnnouncementsPage() {
  const supabase = await createClient()

  // 1. Authenticate & Secure the Route
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // 2. Fetch Enrolled Classes to filter targeted announcements
  const { data: enrollments } = await supabase
    .from('class_enrollments')
    .select('class_id')
    .eq('student_id', user.id)

  const enrolledClassIds = enrollments?.map(e => e.class_id) || []

  // 3. Build the RLS-Safe Audience Query
  // Students should see: audience='all', audience='students', or audience='class' (if they are in the target_class)
  let audienceFilter = 'audience.eq.all,audience.eq.students'
  if (enrolledClassIds.length > 0) {
    const classIdString = enrolledClassIds.join(',')
    audienceFilter += `,and(audience.eq.class,target_class.in.(${classIdString}))`
  }

  // 4. Fetch the Transmissions
  const { data: announcements, error } = await supabase
    .from('announcements')
    .select(`
      id,
      title,
      body,
      audience,
      sent_at,
      profiles!author_id (full_name, role)
    `)
    .eq('status', 'sent')
    .or(audienceFilter)
    .order('sent_at', { ascending: false })

  if (error) {
    console.error("Transmission Intercept Error:", error.message)
  }

  // Formatting Date safely
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { 
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    }
    return new Date(dateString).toLocaleDateString('en-US', options)
  }

  return (
    <div className="min-h-screen bg-[#0B1426] text-white font-sans selection:bg-yellow-400 selection:text-black pb-20">
      
      {/* HEADER */}
      <header className="border-b border-white/10 bg-[#0B1426]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <Link href="/student/dashboard" className="text-slate-400 hover:text-yellow-400 transition-colors p-2 bg-white/5 rounded-full hover:bg-white/10">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <p className="text-[10px] font-black tracking-[0.2em] text-yellow-400 uppercase flex items-center gap-2">
                <Radio size={12} className="animate-pulse" /> Encrypted Channel
              </p>
              <h1 className="text-sm sm:text-base font-bold text-white">Incoming Transmissions</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        
        <div className="mb-10 flex items-center gap-4">
          <div className="w-16 h-16 bg-yellow-400/10 rounded-2xl border border-yellow-400/30 flex items-center justify-center text-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.1)]">
            <Bell size={28} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-white uppercase tracking-wider">Comms Link</h2>
            <p className="text-slate-400 text-sm mt-1">Official directives and intelligence briefs.</p>
          </div>
        </div>

        <div className="space-y-6">
          {announcements && announcements.length > 0 ? (
            announcements.map((msg: any) => (
              <div key={msg.id} className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 relative overflow-hidden transition-all hover:bg-white/[0.07] hover:border-yellow-400/30">
                
                {/* Meta Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#0B1426] border border-white/10 rounded-full flex items-center justify-center text-slate-400">
                      <UserSquare2 size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{msg.profiles?.full_name || 'Central Command'}</p>
                      <p className="text-[10px] font-black tracking-widest uppercase text-slate-500">
                        {msg.profiles?.role === 'admin' ? 'Proprietor' : 'Commander'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400 bg-[#0B1426] px-3 py-1.5 rounded-lg border border-white/5">
                    <CalendarDays size={14} className="text-yellow-400" />
                    {msg.sent_at ? formatDate(msg.sent_at) : 'Date Unknown'}
                  </div>
                </div>

                {/* Content block */}
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    {msg.audience === 'class' && (
                      <span className="px-2 py-1 bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase tracking-wider rounded border border-blue-500/20">Class Specific</span>
                    )}
                    <h3 className="text-xl sm:text-2xl font-bold text-white">{msg.title}</h3>
                  </div>
                  
                  <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                    {msg.body}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white/5 border border-dashed border-white/10 rounded-3xl">
              <ShieldAlert size={48} className="text-slate-600 mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Comms Silence</h3>
              <p className="text-slate-400 text-sm max-w-sm">There are no incoming transmissions or active directives on this channel.</p>
            </div>
          )}
        </div>

      </main>
    </div>
  )
}