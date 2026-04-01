import { createClient } from '@insforge/sdk';

const CLASSPULSE_URL = import.meta.env.VITE_INSFORGE_URL;
const ANON_KEY = import.meta.env.VITE_INSFORGE_ANON_KEY;

export const classPulse = createClient({
  baseUrl: CLASSPULSE_URL,
  anonKey: ANON_KEY
});

/**
 * Verify Teacher Email with 6-digit OTP
 */
export async function verifyTeacherEmail(email, otp) {
  const { data, error } = await classPulse.auth.verifyEmail({
    email,
    otp,
  });
  return { user: data?.user, error };
}

/**
 * Resend Verification Code
 */
export async function resendVerification(email) {
  const { data, error } = await classPulse.auth.resendVerificationEmail({
    email,
  });
  return { data, error };
}

/**
 * Real Teacher registration Flow
 */
export async function signUpTeacher(email, password) {
  const { data, error } = await classPulse.auth.signUp({
    email,
    password,
  });
  return { user: data?.user, requireEmailVerification: data?.requireEmailVerification, error };
}

/**
 * Real Teacher Login Flow
 */
export async function loginTeacher(email, password) {
  const { data, error } = await classPulse.auth.signInWithPassword({
    email,
    password,
  });
  return { user: data?.user, error };
}

/**
 * Google Social Auth for Teachers
 */
export async function loginWithGoogle() {
  const { data, error } = await classPulse.auth.signInWithOAuth({
    provider: 'google',
    redirectTo: window.location.origin + '/teacher/config'
  });
  return { data, error };
}

/**
 * Log out and clear local state
 */
export async function logoutTeacher() {
  const { error } = await classPulse.auth.signOut();
  localStorage.removeItem('cp_instructor_auth');
  return { error };
}

/**
 * Get the current session if it exists
 */
export async function getCurrentSession() {
  const { data, error } = await classPulse.auth.getCurrentSession();
  return { session: data?.session, error };
}

/**
 * Get current authenticated user
 */
export async function getCurrentUser() {
  const { data: { user } } = await classPulse.auth.getUser();
  return user;
}
