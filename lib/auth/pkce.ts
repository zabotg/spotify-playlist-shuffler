import { createHash, randomBytes } from 'crypto';

const RANDOM_BYTES_LENGTH = 32;

export interface PkcePair {
  codeVerifier: string;
  codeChallenge: string;
}

export function generatePkcePair(): PkcePair {
  const codeVerifier = randomBytes(RANDOM_BYTES_LENGTH).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
  return { codeVerifier, codeChallenge };
}

export function generateState(): string {
  return randomBytes(RANDOM_BYTES_LENGTH).toString('base64url');
}
