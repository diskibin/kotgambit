import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type Variant =
  'primary' | 'success' | 'secondary' | 'premium' | 'caution' | 'text' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** The main button of a screen is large: 56 px high. */
  large?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}

// "Shashka": an outline plus a hard shadow, the button sinks into it when pressed
const SHASHKA =
  'border-2 border-edge shadow-shashka transition-[transform,box-shadow] duration-press ease-spring motion-reduce:transition-none active:translate-x-press active:translate-y-press active:shadow-none motion-reduce:active:translate-x-0 motion-reduce:active:translate-y-0';

const VARIANTS: Record<Variant, string> = {
  primary: `${SHASHKA} bg-brand text-on-brand`,
  success: `${SHASHKA} bg-mint text-on-accent`,
  secondary: `${SHASHKA} bg-surface text-text`,
  // Premium is a sun plate (components.md): the one color that says "this is the paid thing"
  premium: `${SHASHKA} bg-sun text-on-accent`,
  // Giving up: a calm coral plate, still a button of the same family
  caution: `${SHASHKA} bg-coral-tint text-coral-text`,
  text: 'text-brand-text',
  // Leaving or deleting: quiet, coral text, never the main button
  danger: 'text-coral-text',
};

/** The look of a button, also for a link that has to look like one. */
export function buttonClassName({
  variant = 'primary',
  large = false,
  fullWidth = false,
  className = '',
}: {
  variant?: Variant;
  large?: boolean;
  fullWidth?: boolean;
  className?: string;
} = {}): string {
  const size =
    variant === 'text' || variant === 'danger'
      ? 'min-h-11'
      : large
        ? 'h-14 text-[18px]'
        : 'h-12 text-[16px]';
  return `flex items-center justify-center gap-2.5 rounded-card px-4 font-extrabold disabled:cursor-not-allowed disabled:opacity-85 ${size} ${VARIANTS[variant]} ${fullWidth ? 'w-full' : ''} ${className}`;
}

export function Button({
  variant = 'primary',
  large = false,
  fullWidth = false,
  className = '',
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClassName({ variant, large, fullWidth, className })}
      {...rest}
    >
      {children}
    </button>
  );
}
