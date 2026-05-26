import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { 
  ArrowLeft, Plus, Clock, Calendar, 
  Trophy, BarChart2, BookOpen, CalendarDays
} from 'lucide-react'
import { DeleteButton } from './DeleteButton'
import { CopyLinkButton } from './CopyLinkButton' // ✅ Import our new share button

export default async function AssessmentVaultPage() {
  // 1. Initialize Server Client
  const supabase = await createClient()
  
  // 2. Authenticate
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/auth/admin/login')
  }

  // 3. Fetch Data on the Server
  const { data: quizzes } = await supabase
    .from('quizzes')
    .select('*')
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: false })

  // 4. Server Action for Deletion
  async function deleteQuiz(formData: FormData) {
    'use server'
    const quizId = formData.get('quizId') as string
    const supabaseServer = await createClient()
    
    await supabaseServer
      .from('quizzes')
      .delete()
      .eq('id', quizId)
      
    // Refresh the page data instantly
    revalidatePath('/teacher/quizzes') 
  }

  const hasQuizzes = quizzes && quizzes.length > 0;

  return (
    <div className="min-h-screen bg-[#0B1426] text-white font-sans selection:bg-yellow-400 selection:text-black pb-20">
      
      {/* HEADER */}
      <header className="border-b border-white/10 bg-[#0B1426]/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/teacher/dashboard" className="text-slate-400 hover:text-yellow-400 transition-colors">
              <ArrowLeft size={24} />
            </Link>
            <div>
              <p className="text-[10px] font-black tracking-[0.2em] text-yellow-400 uppercase">Database</p>
              <h1 className="text-lg font-bold text-white">Assessment Vault</h1>
            </div>
          </div>
          <Link 
            href="/teacher/quiz/new" 
            className="px-5 py-2.5 bg-yellow-400 text-[#0B1426] rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-yellow-300 transition-colors shadow-[0_0_15px_rgba(250,204,21,0.2)]"
          >
            <Plus size={16} /> <span className="hidden sm:inline">New Assessment</span>
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 mt-12">
        
        {!hasQuizzes ? (
          /* EMPTY STATE */
          <div className="bg-white/5 border border-dashed border-white/20 rounded-3xl p-16 flex flex-col items-center justify-center text-center mt-10">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
              <BookOpen className="text-slate-400" size={40} />
            </div>
            <h2 className="text-2xl font-black text-white mb-2">Vault is Empty</h2>
            <p className="text-slate-400 max-w-md mx-auto mb-8">
              You haven't deployed any CBT assessments yet. Use the AI Logic Engine to extract questions from a document and create your first one.
            </p>
            <Link 
              href="/teacher/quiz/new" 
              className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold tracking-wide transition-colors"
            >
              Initialize First Assessment
            </Link>
          </div>
        ) : (
          /* ASSESSMENT GRID */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quizzes.map((quiz) => (
              <div key={quiz.id} className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col hover:border-white/20 transition-colors group">
                
                {/* Card Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 bg-[#0B1426] border border-white/10 rounded-xl flex items-center justify-center shrink-0">
                    <BookOpen className="text-yellow-400" size={18} />
                  </div>
                  
                  {/* The Server Action Form uses our Client Delete Button */}
                  <form action={deleteQuiz}>
                    <input type="hidden" name="quizId" value={quiz.id} />
                    <DeleteButton />
                  </form>
                </div>

                {/* Title & Metadata */}
                <h3 className="text-xl font-bold text-white leading-tight mb-4 line-clamp-2">
                  {quiz.title}
                </h3>
                
                <div className="space-y-3 mb-6 flex-1">
                  {/* ✅ Clear Creation Date Added Here */}
                  <div className="flex items-center gap-3 text-sm text-slate-400">
                    <CalendarDays size={16} className="text-slate-500" />
                    <span>Created: {new Date(quiz.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-400">
                    <Calendar size={16} className="text-slate-500" />
                    <span>Deadline: {quiz.deadline ? new Date(quiz.deadline).toLocaleDateString() : 'Open Ended'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-400">
                    <Clock size={16} className="text-slate-500" />
                    <span>Time Limit: {quiz.time_limit} Minutes</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-yellow-400/80 font-medium">
                    <Trophy size={16} />
                    <span>{quiz.reward_value} {quiz.reward_type}</span>
                  </div>
                </div>

                {/* Card Footer Actions - Split Layout */}
                <div className="pt-4 border-t border-white/10 mt-auto flex gap-3">
                  <Link 
                    href={`/teacher/results/${quiz.id}`} 
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
                  >
                    <BarChart2 size={16} /> Analytics
                  </Link>
                  
                  {/* ✅ Link Sharing Button Component */}
                  <CopyLinkButton quizId={quiz.id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}