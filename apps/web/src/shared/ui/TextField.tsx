import { useId, type InputHTMLAttributes, type ReactNode } from 'react';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  /** Replaces the hint and turns the field coral: a mistake is explained, never shouted. */
  error?: ReactNode | undefined;
  hint?: string | undefined;
  /** A button inside the right edge of the field, such as the eye of a password field. */
  endAdornment?: ReactNode | undefined;
  /** Something next to the label on the right, such as a link. */
  labelAside?: ReactNode | undefined;
  /** Marks the field coral without a message of its own, for an error explained elsewhere. */
  invalid?: boolean | undefined;
}

export function TextField({
  label,
  error,
  hint,
  endAdornment,
  labelAside,
  invalid = false,
  disabled,
  ...rest
}: TextFieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const failed = invalid || Boolean(error);
  const message = error ?? hint;

  const tone = failed
    ? 'border-coral bg-coral-tint'
    : disabled
      ? 'border-line bg-disabled-bg'
      : 'border-line bg-surface';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-[14px] font-extrabold">
          {label}
        </label>
        {labelAside}
      </div>
      <div className="relative flex">
        <input
          id={id}
          disabled={disabled}
          aria-invalid={failed}
          aria-describedby={message ? messageId : undefined}
          className={`h-[52px] min-w-0 grow rounded-input border-2 px-4 pr-14 text-[16px] font-semibold text-text placeholder:text-text-muted focus:border-brand ${tone}`}
          {...rest}
        />
        {endAdornment && <div className="absolute right-1 top-1">{endAdornment}</div>}
      </div>
      {message && (
        <span
          id={messageId}
          className={`text-[14px] leading-5 font-bold ${error ? 'text-coral-text' : 'text-text-2'}`}
        >
          {message}
        </span>
      )}
    </div>
  );
}
