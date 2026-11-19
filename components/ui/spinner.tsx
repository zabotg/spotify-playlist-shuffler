import { LoaderCircle } from 'lucide-react';

interface SpinnerProps {
  className?: string;
  /** Read by screen readers. Leave empty when nearby text already says what is loading. */
  label?: string;
}

export function Spinner({ className = 'h-4 w-4', label }: SpinnerProps) {
  return (
    <>
      <LoaderCircle aria-hidden className={`shrink-0 animate-spin ${className}`} />
      {label && <span className="sr-only">{label}</span>}
    </>
  );
}
