import { Music } from 'lucide-react';
import Image from 'next/image';

interface CoverImageProps {
  src: string | null;
  alt: string;
  sizes: string;
  className?: string;
  /** Use "eager" for covers visible on first paint, so the browser doesn't defer the LCP image. */
  loading?: 'lazy' | 'eager';
}

export function CoverImage({ src, alt, sizes, className = '', loading = 'lazy' }: CoverImageProps) {
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-md bg-zinc-800 ${className}`}>
      {src ? (
        <Image src={src} alt={alt} fill sizes={sizes} loading={loading} className="object-cover" />
      ) : (
        <span aria-hidden className="absolute inset-0 flex items-center justify-center bg-zinc-800 text-zinc-500">
          <Music className="h-2/5 max-h-16 w-2/5 max-w-16" strokeWidth={1.5} />
        </span>
      )}
    </div>
  );
}
