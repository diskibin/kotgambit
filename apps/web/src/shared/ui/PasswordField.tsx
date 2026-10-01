import { useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { TextField } from './TextField';

type PasswordFieldProps = Omit<ComponentProps<typeof TextField>, 'type' | 'endAdornment'>;

/** A password input with an eye button that shows or hides what was typed. */
export function PasswordField(props: PasswordFieldProps) {
  const { t } = useTranslation();
  const [shown, setShown] = useState(false);

  return (
    <TextField
      {...props}
      type={shown ? 'text' : 'password'}
      endAdornment={
        <button
          type="button"
          aria-label={t(shown ? 'auth.password.hide' : 'auth.password.show')}
          aria-pressed={shown}
          onClick={() => setShown((value) => !value)}
          className="flex size-11 items-center justify-center rounded-[10px] text-text-2"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
            {shown && <path d="M4 4l16 16" />}
          </svg>
        </button>
      }
    />
  );
}
