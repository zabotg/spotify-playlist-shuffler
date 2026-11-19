import Image from 'next/image';

interface CoverImageProps {
  src: string | null;
  alt: string;
  sizes: string;
  className?: string;
}

export function CoverImage({ src, alt, sizes, className = '' }: CoverImageProps) {
  return (
    <div className={`relative shrink-0 overflow-hidden rounded bg-zinc-800 ${className}`}>
      {src ? (
        <Image src={src} alt={alt} fill sizes={sizes} className="object-cover" />
      ) : (
        <span aria-hidden className="absolute inset-0 flex items-center justify-center text-zinc-500">
          ♪
        </span>
      )}
    </div>
  );
}
