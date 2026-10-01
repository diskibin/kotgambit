import { useEffect, useRef, type ReactNode } from 'react';

interface DialogProps {
  label: string;
  onClose: () => void;
  children: ReactNode;
}

/** A centred card over a dimmed page. The safe action gets the focus, Escape closes. */
export function Dialog({ label, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="flex w-full max-w-[400px] flex-col items-center gap-3 rounded-[28px] border-3 border-edge bg-surface p-6 text-center shadow-shashka-lg"
      >
        {children}
      </div>
    </div>
  );
}
