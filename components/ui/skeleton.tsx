/** A pulsing placeholder block. Give it the size of the content it stands in for, so nothing jumps on load. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-md bg-zinc-800/70 ${className}`} />;
}
