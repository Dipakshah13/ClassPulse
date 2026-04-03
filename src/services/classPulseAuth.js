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
  const user = data?.user || data;
  return { user: user || null, error };
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
  const user = data?.user || data;
  return { user, requireEmailVerification: data?.requireEmailVerification, error };
}

/**
 * Real Teacher Login Flow
 */
export async function loginTeacher(email, password) {
  const { data, error } = await classPulse.auth.signInWithPassword({
    email,
    password,
  });
  // Handle consistent return format
  return { user: data?.user || data, error };
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

export async function getCurrentSession() {
  try {
    const { data, error } = await classPulse.auth.getCurrentUser();
    // Return in a format that App.jsx expects (session.user)
    // Handle both { data: user } and { data: { user } }
    const user = data?.user || data;
    return { session: user ? { user } : null, error };
  } catch (err) {
    return { session: null, error: err };
  }
}

/**
 * Send Password Reset Email
 */
export async function sendResetPasswordEmail(email) {
  const { data, error } = await classPulse.auth.sendResetPasswordEmail({
    email,
  });
  return { data, error };
}

/**
 * Reset User Password with OTP
 */
export async function resetUserPassword(email, otp, newPassword) {
  try {
    // 1. Exchange the 6-digit code for a reset token
    const { data: resetToken, error: exchangeError } = await classPulse.auth.exchangeResetPasswordToken({
      email,
      code: otp
    });
    
    if (exchangeError) throw exchangeError;
    if (!resetToken?.token) throw new Error("Invalid or expired reset token.");

    // 2. Perform the actual password reset
    const { data, error: resetError } = await classPulse.auth.resetPassword({
      newPassword,
      otp: resetToken.token
    });

    return { data, error: resetError };
  } catch (err) {
    return { data: null, error: err };
  }
}

/**
 * Get current authenticated user
 */
export async function getCurrentUser() {
  const { data: { user } } = await classPulse.auth.getUser();
  return user;
}
