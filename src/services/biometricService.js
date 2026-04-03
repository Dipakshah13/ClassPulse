/**
 * biometricService.js - Safe-Mode Implementation
 * ─────────────────────────────────────────────
 * Removed strict IDs to allow for automatic browser fallback.
 * Uses 16-byte fixed binary mapping for maximum hardware compatibility.
 */

export const isBiometricAvailable = async () => {
  return (
    window.PublicKeyCredential &&
    await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  );
};

// Helper: Ensure 16-byte buffer for compatibility
const safeBuffer = (str) => {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(str);
  const buffer = new Uint8Array(16);
  buffer.set(encoded.slice(0, 16));
  return buffer;
};

/**
 * Enroll a new device (Safe-Mode)
 */
export const enrollDevice = async (email) => {
  if (!await isBiometricAvailable()) throw new Error('Hardware Not Detected');

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = safeBuffer(email);

  const options = {
    publicKey: {
      challenge: challenge,
      rp: { name: 'ClassPulse' }, // Omit ID to let browser auto-resolve
      user: {
        id: userId,
        name: email,
        displayName: email.split('@')[0],
      },
      pubKeyCredParams: [{ alg: -7, type: 'public-key' }], 
      authenticatorSelection: { 
        authenticatorAttachment: 'platform',
        userVerification: 'preferred'
      },
      timeout: 60000,
    }
  };

  try {
    const credential = await navigator.credentials.create(options);
    if (credential) {
      localStorage.setItem(`cp_bio_trust_${email}`, 'enabled');
      return true;
    }
  } catch (e) {
    console.error('[WebAuthn Error]:', e);
    throw e;
  }
  return false;
};

/**
 * Authenticate using native hardware
 */
export const authenticateDevice = async (email) => {
  if (!localStorage.getItem(`cp_bio_trust_${email}`)) {
    throw new Error('Device not enrolled.');
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const options = {
    publicKey: {
      challenge: challenge,
      timeout: 60000,
      userVerification: 'preferred',
    }
  };

  try {
    const assertion = await navigator.credentials.get(options);
    return !!assertion;
  } catch (e) {
    console.error('[WebAuthn Error]:', e);
    throw e;
  }
};
