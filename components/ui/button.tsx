import type { ButtonHTMLAttributes } from 'react';
import { Spinner } from './spinner';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
type ButtonSize = 'md' | 'lg';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'gap-2 rounded-full bg-spotify font-semibold text-zinc-950 hover:bg-spotify-bright disabled:hover:bg-spotify',
  secondary: 'gap-2 rounded-full bg-zinc-100 font-semibold text-zinc-950 hover:bg-white disabled:hover:bg-zinc-100',
  outline:
    'gap-2 rounded-full border border-zinc-700 font-medium text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800/60 hover:text-white',
  ghost: 'gap-1 rounded-full px-3 py-2 text-zinc-400 hover:bg-zinc-800/60 hover:text-white',
};

/** Sizes for the filled and outlined pills. Ghost buttons stay compact so they sit inline with text. */
const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: 'min-h-11 px-6 py-2.5',
  lg: 'min-h-12 px-7 py-3 text-base',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner, disables the button and marks it busy. */
  isLoading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  type = 'button',
  disabled,
  children,
  ...props
}: ButtonProps) {
  const sizeClasses = variant === 'ghost' ? '' : SIZE_CLASSES[size];
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={`inline-flex items-center justify-center text-sm transition-colors duration-150 disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${sizeClasses} ${className}`}
      {...props}
    >
      {isLoading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}
