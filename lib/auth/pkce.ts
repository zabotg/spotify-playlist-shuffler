/**
 * PKCE (Proof Key for Code Exchange) utilities.
 *
 * Prevents authorization code interception attacks:
 * - code_verifier: random secret, stays on server
 * - code_challenge: SHA-256(code_verifier), sent to Spotify
 * - Spotify verifies: SHA-256(received_verifier) === stored_challenge
 *
 * Even if auth code is intercepted, attacker cannot exchange it
 * without the code_verifier that only our server holds.
 */

import { randomBytes, createHash } from 'crypto';

export interface PKCEPair {
  codeVerifier: string;
  codeChallenge: string;
}

export function generatePKCE(): PKCEPair {
  // 32 bytes = 256 bits of entropy, base64url-encoded = 43 chars
  // Spotify requires verifier to be 43–128 chars
  const codeVerifier = randomBytes(32).toString('base64url');

  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  return { codeVerifier, codeChallenge };
}

/** Cryptographically random state parameter to prevent CSRF on OAuth flow */
export function generateState(): string {
  return randomBytes(32).toString('base64url');
}
