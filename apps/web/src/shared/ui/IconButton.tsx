import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: an icon alone says nothing to a screen reader. */
  label: string;
  children: ReactNode;
  /** The big "shashka" button (52 px) or a quiet one for toolbars. */
  quiet?: boolean;
}

export function IconButton({
  label,
  children,
  quiet = false,
  className = '',
  ...rest
}: IconButtonProps) {
  const look = quiet
    ? 'size-11 rounded-control text-text-2 hover:bg-surface-2'
    : 'size-[52px] rounded-control border-2 border-edge bg-surface text-text shadow-shashka transition-[transform,box-shadow] duration-press ease-spring active:translate-x-press active:translate-y-press active:shadow-none motion-reduce:transition-none motion-reduce:active:translate-x-0 motion-reduce:active:translate-y-0';
  return (
    <button
      type="button"
      aria-label={label}
      className={`flex shrink-0 items-center justify-center disabled:cursor-not-allowed disabled:opacity-60 ${look} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
