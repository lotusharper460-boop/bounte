// Force Next.js to read your live cookies every time you start a test!
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import QuizClient from './QuizClient'

export default async function StudentQuizPage({ 
  params 
}: { 
  params: Promise<{ quizId: string }> 
}) {
  const resolvedParams = await params;
  const targetQuizId = resolvedParams.quizId;
  
  const supabase = await createClient()

  // 1. Authenticate
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/auth/login?redirectTo=/student/campaign/${targetQuizId}`)
  }

  // 2. Identify User
  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
  const studentName = profile?.full_name || 'Operative'

  // 3. Fetch Quiz Details
  const { data: quiz, error: quizError } = await supabase
    .from('quizzes')
    .select('*, classes(id)') 
    .eq('id', targetQuizId)
    .single()
    
  if (quizError || !quiz) {
    return (
      <div className="min-h-screen bg-[#0B1426] text-white flex justify-center items-center">
        <h1 className="text-2xl font-black text-red-400">404 - Assessment Not Found</h1>
      </div>
    )
  }

  // 4. Check for Existing Submission
  const { data: existingSubmission } = await supabase
    .from('submissions')
    .select('id')
    .eq('quiz_id', quiz.id)
    .eq('student_id', user.id)
    .single()
    
  // If they already took it, instantly bounce them back to the leaderboard
  if (existingSubmission) {
    redirect(`/student/campaign/${targetQuizId}`)
  }

  // 5. Fetch Questions WITH Media Asset Join
  const { data: questions } = await supabase
    .from('questions')
    .select('id, question_text, options, media_assets(file_url)')
    .eq('quiz_id', quiz.id)
    .order('order_index', { ascending: true })
    
  if (!questions || questions.length === 0) {
    return (
      <div className="min-h-screen bg-[#0B1426] text-white flex flex-col justify-center items-center">
        <p className="text-slate-400 mb-4">No questions found. The Proprietor needs to populate this operation.</p>
      </div>
    )
  }

  const resolvedClassId = quiz.class_id || (quiz.classes && quiz.classes.id) || null

  // 6. Launch CBT Engine
  return <QuizClient 
    quiz={quiz} 
    classId={resolvedClassId} 
    questions={questions} 
    studentName={studentName} 
  />
}