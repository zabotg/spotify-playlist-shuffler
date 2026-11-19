export const LOGIN_ERROR_MESSAGES = {
  access_denied: 'You cancelled the Spotify login.',
  invalid_callback: 'Invalid login attempt.',
  state_mismatch: 'Security check failed. Please try again.',
  token_exchange_failed: 'Could not connect to Spotify. Please try again.',
} as const;

export type LoginError = keyof typeof LOGIN_ERROR_MESSAGES;

export function getLoginErrorMessage(code: string | undefined): string | null {
  if (!code || !Object.hasOwn(LOGIN_ERROR_MESSAGES, code)) return null;
  return LOGIN_ERROR_MESSAGES[code as LoginError];
}
