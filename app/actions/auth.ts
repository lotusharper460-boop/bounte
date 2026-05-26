'use server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin'; // Make sure this utility exists
import { redirect } from 'next/navigation';

// ==========================================
// 1. LOGIN ACTION
// ==========================================
export async function loginAction(formData: FormData) {
  const email = formData.get('email')?.toString();
  const password = formData.get('password')?.toString();
  const portal = formData.get('portal')?.toString(); // 'admin' or 'student'

  const targetErrorPath = portal === 'admin' ? '/auth/admin/login' : '/auth/login';

  if (!email || !password) {
    redirect(`${targetErrorPath}?error=${encodeURIComponent('Email and password are required.')}`);
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(`${targetErrorPath}?error=${encodeURIComponent(error.message)}`);
  }

  redirect(portal === 'admin' ? '/teacher/dashboard' : '/student/dashboard');
}

// ==========================================
// 2. DIRECT SIGNUP ACTION
// ==========================================
export async function signUpAction(formData: FormData) {
  const email = formData.get('email')?.toString();
  const password = formData.get('password')?.toString();
  const fullName = formData.get('fullName')?.toString();
  const phone = formData.get('phone')?.toString() || '';
  const role = formData.get('role')?.toString() || 'student';
  
  const targetPath = role === 'teacher' ? '/auth/admin/register' : '/auth/register';

  if (!email || !password || !fullName) {
    redirect(`${targetPath}?error=${encodeURIComponent('Email, password, and full name are required.')}`);
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        phone_number: phone,
        role: role
      }
    }
  });

  if (error) {
    redirect(`${targetPath}?error=${encodeURIComponent(error.message)}`);
  }

  redirect(role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard');
}

// ==========================================
// 3. PASSWORD RESET ACTION (No Email Required)
// ==========================================
export async function resetPasswordAction(formData: FormData) {
  const email = formData.get('email')?.toString();
  const phone = formData.get('phone')?.toString();
  const newPassword = formData.get('newPassword')?.toString();

  if (!email || !phone || !newPassword) {
    redirect('/auth/forgot-password?error=' + encodeURIComponent('All fields are required.'));
  }

  const supabase = await createClient();

  // 1. Verify user exists and credentials match via the public profiles table
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .eq('phone_number', phone)
    .single();

  if (profileError || !profile) {
    redirect('/auth/forgot-password?error=' + encodeURIComponent('Verification failed: Credentials do not match our records.'));
  }

  // 2. Use Admin Client to force update the user's password
  const adminSupabase = await createAdminClient();
  const { error: authError } = await adminSupabase.auth.admin.updateUserById(
    profile.id,
    { password: newPassword }
  );

  if (authError) {
    redirect('/auth/forgot-password?error=' + encodeURIComponent(authError.message));
  }

  redirect('/auth/login?message=' + encodeURIComponent('Password reset successful! Please log in.'));
}
// ==========================================
// 4. LOGOUT ACTION
// ==========================================
export async function logoutAction() {
  const supabase = await createClient();
  
  // Sign the user out from Supabase
  await supabase.auth.signOut();
  
  // Redirect them back to the login page
  redirect('/auth/login');
}