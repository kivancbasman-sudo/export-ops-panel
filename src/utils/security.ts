// Security & PIN Hashing Utilities using Web Cryptography API

export const DEFAULT_PIN_HASH = '74113a138e70c930bfe9bdc737ed92fd8cef86d080cb16389385b0d9d1b2bfcc';
export const AUTH_STORAGE_KEY = 'ihracat_panel_auth_token';

/**
 * Computes a standard SHA-256 hex string of the input text using native Web Crypto.
 */
export async function hashText(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifies if the supplied PIN matches the stored hash or default hash.
 */
export async function verifyPin(pin: string, storedHash?: string): Promise<boolean> {
  if (!pin) return false;
  const computed = await hashText(pin);
  const targetHash = (storedHash && storedHash.trim()) ? storedHash.trim() : DEFAULT_PIN_HASH;
  return computed === targetHash;
}

/**
 * Generates a cryptographic session token linked to the active PIN hash.
 */
export async function generateSessionToken(activeHash: string): Promise<string> {
  return await hashText(`authenticated_session_${activeHash}`);
}

/**
 * Checks if a session token is valid for the current PIN hash.
 */
export async function isValidSessionToken(token: string | null, activeHash: string): Promise<boolean> {
  if (!token) return false;
  const expected = await generateSessionToken(activeHash);
  return token === expected;
}

