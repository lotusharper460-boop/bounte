'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { ArrowLeft, Megaphone, Send, Radio, History, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

interface ClassData {
  id: string;
  name: string;
}

interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: string;
  sent_at: string;
}

export default function BroadcastCenter() {
  const [supabase] = useState(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ))

  // State
  const [classes, setClasses] = useState<ClassData[]>([])
  const [history, setHistory] = useState<Announcement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form State
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState('all') // 'all', 'students', 'class'
  const [targetClass, setTargetClass] = useState('')

  useEffect(() => {
    fetchData()
  }, [supabase])

  const fetchData = async () => {
    setIsLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Fetch classes for the dropdown
    const { data: classData } = await supabase
      .from('classes')
      .select('id, name')
      .eq('teacher_id', user.id)

    if (classData) setClasses(classData)

    // Fetch historical announcements
    const { data: logs } = await supabase
      .from('announcements')
      .select('id, title, body, audience, sent_at')
      .eq('author_id', user.id)
      .order('sent_at', { ascending: false })

    if (logs) setHistory(logs)
    setIsLoading(false)
  }

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title || !body) return alert("Title and Body are required.")
    if (audience === 'class' && !targetClass) return alert("Please select a target class.")

    setIsSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      const { error } = await supabase
        .from('announcements')
        .insert([{
          author_id: user.id,
          title,
          body,
          audience,
          target_class: audience === 'class' ? targetClass : null,
          status: 'sent',
          sent_at: new Date().toISOString()
        }])

      if (error) throw error

      // Reset Form
      setTitle('')
      setBody('')
      setAudience('all')
      setTargetClass('')
      
      // Refresh Logs
      fetchData()

    } catch (error: any) {
      console.error(error)
      alert("Transmission Failed: " + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

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
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center gap-6">
          <Link href="/teacher/dashboard" className="text-slate-400 hover:text-yellow-400 transition-colors bg-white/5 p-2 rounded-full hover:bg-white/10">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <p className="text-[10px] font-black tracking-[0.2em] text-yellow-400 uppercase flex items-center gap-2">
              <Radio size={12} className="animate-pulse" /> Network Active
            </p>
            <h1 className="text-lg font-bold text-white">Broadcast Center</h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-2 gap-10">
        
        {/* LEFT COLUMN: COMPOSER */}
        <div>
          <div className="mb-8 flex items-center gap-4">
            <div className="w-12 h-12 bg-yellow-400/10 rounded-xl border border-yellow-400/30 flex items-center justify-center text-yellow-400">
              <Megaphone size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-wide">Compose Message</h2>
              <p className="text-slate-400 text-sm">Deploy directives to operatives across the network.</p>
            </div>
          </div>

          <form onSubmit={handleBroadcast} className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6">
            
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Transmission Title</label>
              <input 
                type="text" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Immediate Server Maintenance" 
                required
                className="w-full bg-[#0B1426]/50 border border-white/10 rounded-xl p-4 text-white focus:border-yellow-400 focus:outline-none transition-colors" 
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Message Payload</label>
              <textarea 
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Enter your directive here..." 
                rows={5}
                required
                className="w-full bg-[#0B1426]/50 border border-white/10 rounded-xl p-4 text-white focus:border-yellow-400 focus:outline-none transition-colors resize-none" 
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Target Audience</label>
                <select 
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  className="w-full bg-[#0B1426]/50 border border-white/10 rounded-xl p-4 text-white focus:border-yellow-400 focus:outline-none transition-colors appearance-none"
                >
                  <option value="all">Global (All Users)</option>
                  <option value="students">All Operatives (Students)</option>
                  <option value="class">Specific Classroom</option>
                </select>
              </div>

              {/* DYNAMIC CLASS SELECTOR */}
              {audience === 'class' && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <label className="block text-xs font-bold text-yellow-400 uppercase tracking-wider mb-2">Select Classroom</label>
                  <select 
                    value={targetClass}
                    onChange={(e) => setTargetClass(e.target.value)}
                    required
                    className="w-full bg-yellow-400/5 border border-yellow-400/30 rounded-xl p-4 text-yellow-400 focus:border-yellow-400 focus:outline-none transition-colors appearance-none"
                  >
                    <option value="">-- Choose Class --</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id} className="text-black">{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full py-4 bg-yellow-400 text-[#0B1426] rounded-xl font-black uppercase tracking-widest hover:bg-yellow-300 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(250,204,21,0.2)] disabled:opacity-50"
            >
              {isSubmitting ? <><Loader2 size={18} className="animate-spin" /> Transmitting...</> : <><Send size={18} /> Execute Broadcast</>}
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN: TRANSMISSION LOG */}
        <div className="lg:border-l border-white/10 lg:pl-10">
          <div className="mb-8 flex items-center gap-2 text-slate-400">
            <History size={18} />
            <h3 className="font-bold uppercase tracking-widest text-sm">Transmission Log</h3>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-10 text-yellow-400"><Loader2 className="animate-spin" size={32} /></div>
          ) : history.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center bg-white/5 border border-dashed border-white/10 rounded-3xl">
              <AlertCircle size={32} className="text-slate-600 mb-4" />
              <p className="text-slate-400 text-sm">No historical broadcasts found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map(log => (
                <div key={log.id} className="bg-[#0B1426] border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded border ${
                      log.audience === 'all' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 
                      log.audience === 'students' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                      'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    }`}>
                      {log.audience === 'class' ? 'Class Specific' : log.audience === 'all' ? 'Global Payload' : 'Operative Wide'}
                    </span>
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold uppercase">
                      <CheckCircle2 size={12} className="text-emerald-400" /> Sent {formatDate(log.sent_at)}
                    </div>
                  </div>
                  <h4 className="text-white font-bold mb-2 line-clamp-1">{log.title}</h4>
                  <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed">{log.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  )
}