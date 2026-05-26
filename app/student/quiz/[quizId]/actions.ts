'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function gradeAndSubmitQuiz(
  quizId: string, 
  classId: string | null,
  studentName: string, 
  timeTakenSeconds: number, 
  studentAnswers: Record<string, number>
) {
  const supabase = await createClient()

  // 1. Get the real user (CRITICAL FIX: Do not use randomUUID)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized. Submission rejected.")

  // 2. Fetch the actual answer key
  const { data: questions, error: fetchError } = await supabase
    .from('questions')
    .select('id, correct_index')
    .eq('quiz_id', quizId)

  if (fetchError || !questions) {
    throw new Error("Could not fetch answer key: " + fetchError?.message)
  }

  // 3. Grade the assessment
  let correctCount = 0
  const totalQuestions = questions.length

  questions.forEach((q) => {
    if (studentAnswers[q.id] === q.correct_index) {
      correctCount++
    }
  })

  const finalScore = totalQuestions > 0 
    ? Math.round((correctCount / totalQuestions) * 100) 
    : 0;

  // 4. Save the submission (Forcing status to 'graded' to trigger bounty logic)
  const { error: insertError } = await supabase
    .from('submissions')
    .insert([
      {
        quiz_id: quizId,
        class_id: classId,
        student_name: studentName,
        student_id: user.id, // REAL STUDENT ID
        score: finalScore,
        status: 'graded', 
        time_taken_seconds: timeTakenSeconds
      }
    ])

  if (insertError) throw new Error(insertError.message)

  // 5. Revalidate cache
  revalidatePath(`/student/campaign/${quizId}`)
  return { success: true, score: finalScore }
}