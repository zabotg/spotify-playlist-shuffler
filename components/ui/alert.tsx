import { CircleAlert, CircleCheck, ExternalLink, Info, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type AlertTone = 'error' | 'success' | 'info';

const TONES: Record<AlertTone, { classes: string; icon: LucideIcon }> = {
  error: { classes: 'border-red-900/80 bg-red-950/50 text-red-200', icon: CircleAlert },
  success: { classes: 'border-green-900/80 bg-green-950/50 text-green-200', icon: CircleCheck },
  info: { classes: 'border-zinc-800 bg-zinc-900/60 text-zinc-300', icon: Info },
};

interface AlertProps {
  tone: AlertTone;
  children: ReactNode;
}

export function Alert({ tone, children }: AlertProps) {
  const { classes, icon: Icon } = TONES[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed ${classes}`}
    >
      <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
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
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-semibold text-green-100 underline underline-offset-2 hover:text-white"
      >
        Open in Spotify
        <ExternalLink aria-hidden className="h-3.5 w-3.5" />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    </Alert>
  );
}
