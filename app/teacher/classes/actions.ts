'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// 1. CREATE A CLASS
export async function createClass(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized access. Please log in again." }
  }

  const name = formData.get('name') as string
  const subject = formData.get('subject') as string
  const academic_year = formData.get('academic_year') as string
  const term = formData.get('term') as string 

  // Strict check to satisfy database Enum
  if (!['1st', '2nd', '3rd'].includes(term)) {
    return { error: "Invalid term selected." }
  }

  const { error } = await supabase
    .from('classes')
    .insert([{
      teacher_id: user.id,
      name,
      subject,
      academic_year,
      term
    }])

  if (error) {
    return { error: error.message }
  }
  
  // Safely refresh cache and signal completion
  revalidatePath('/teacher/classes')
  return { success: true }
}

// 2. SEARCH FOR STUDENTS
export async function searchStudents(searchTerm: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, role')
    .eq('role', 'student')
    .ilike('full_name', `%${searchTerm}%`)
    .limit(5)

  if (error) return []
  return data || []
}

// 3. ENROLL A STUDENT
export async function enrollStudent(classId: string, studentId: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('class_enrollments')
    .insert([{ class_id: classId, student_id: studentId }])

  if (error?.code === '23505') {
    return { error: "Operative is already assigned to this class." }
  }
  if (error) return { error: error.message }

  revalidatePath(`/teacher/classes/${classId}`)
  return { success: true }
}