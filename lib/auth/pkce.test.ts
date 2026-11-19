import { createHash } from 'crypto';
import { describe, expect, it } from 'vitest';
import { getLoginErrorMessage } from './login-errors';
import { generatePkcePair, generateState } from './pkce';

describe('pkce', () => {
  it('derives the challenge as the base64url SHA-256 of the verifier', () => {
    const { codeVerifier, codeChallenge } = generatePkcePair();
    expect(codeVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(codeChallenge).toBe(createHash('sha256').update(codeVerifier).digest('base64url'));
  });

  it('generates a different random state each time', () => {
    expect(generateState()).not.toBe(generateState());
    expect(generateState()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

describe('getLoginErrorMessage', () => {
  it('maps known codes and ignores anything else', () => {
    expect(getLoginErrorMessage('state_mismatch')).toBe('Security check failed. Please try again.');
    expect(getLoginErrorMessage(undefined)).toBeNull();
    expect(getLoginErrorMessage('<script>')).toBeNull();
    expect(getLoginErrorMessage('toString')).toBeNull();
  });
});
