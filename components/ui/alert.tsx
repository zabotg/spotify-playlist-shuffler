import type { ReactNode } from 'react';

type AlertTone = 'error' | 'success';

const TONE_CLASSES: Record<AlertTone, string> = {
  error: 'border-red-700 bg-red-900/40 text-red-300',
  success: 'border-green-700 bg-green-900/40 text-green-300',
};

interface AlertProps {
  tone: AlertTone;
  children: ReactNode;
}

export function Alert({ tone, children }: AlertProps) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm ${TONE_CLASSES[tone]}`}>
      {children}
    </div>
  );
}

export function ErrorAlert({ message }: { message: string | null }) {
  return message ? <Alert tone="error">{message}</Alert> : null;
}

export function SpotifyLinkAlert({ message, url }: { message: string; url: string }) {
  return (
    <Alert tone="success">
      {message}{' '}
      <a href={url} target="_blank" rel="noopener noreferrer" className="underline">
        Open in Spotify
      </a>
    </Alert>
  );
}
