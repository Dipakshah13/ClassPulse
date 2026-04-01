/**
 * cryptoService.js
 * Uses the Web Crypto API (SubtleCrypto) for AES-256-GCM encryption.
 * Encrypts student data before it reaches the cloud.
 */

// Simple salt for PBKDF2 (in a real production app, this would be per-user)
const SALT = new TextEncoder().encode('ClassPulse3.0_Vault_Salt');

/**
 * Derives a CryptoKey from a user-provided password/PIN.
 */
export async function deriveVaultKey(password) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: SALT,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a plaintext string.
 */
export async function encryptData(text, key) {
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // GCM standard IV
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(text)
  );

  // Combine IV + Ciphertext into a single Base64 string
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts a Base64-encoded ciphertext.
 */
export async function decryptData(base64Data, key) {
  const combined = new Uint8Array(
    atob(base64Data).split('').map(c => c.charCodeAt(0))
  );

  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}
