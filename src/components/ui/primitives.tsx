import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'ghost' | 'quiet' | 'danger';

export function Button({
  variant = 'ghost',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-full px-4 h-10 text-sm font-semibold tracking-wide transition',
        'disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]',
        variant === 'primary' &&
          'bg-ink text-bg hover:opacity-90 shadow-card',
        variant === 'ghost' && 'border border-line bg-surface hover:bg-surface-2 text-ink',
        variant === 'quiet' && 'text-muted hover:text-ink hover:bg-surface-2',
        variant === 'danger' && 'border border-down/40 text-down hover:bg-down/10',
        className,
      )}
    />
  );
}

export function Card({ className, children, as: As = 'section' }: { className?: string; children: ReactNode; as?: 'section' | 'div' | 'article' }) {
  return <As className={cx('rounded-3xl border border-line bg-surface shadow-card', className)}>{children}</As>;
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx('text-[11px] font-semibold uppercase tracking-[0.18em] text-faint', className)}>{children}</p>;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = 'md',
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full border border-line bg-surface-2 p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cx(
              'rounded-full font-semibold transition',
              size === 'sm' ? 'px-3 h-7 text-xs' : 'px-4 h-8 text-sm',
              active ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function GainText({ value, children, className }: { value: number; children: ReactNode; className?: string }) {
  return (
    <span className={cx(value > 0.004 ? 'text-up' : value < -0.004 ? 'text-down' : 'text-muted', className)}>{children}</span>
  );
}

/** Accessible modal built on <dialog>: focus trap, Escape to close, backdrop click to close. */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      // React passes a nested dialog's close/cancel events up to this one; only react to our own.
      onClose={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onCancel={(e) => {
        if (e.target !== e.currentTarget) return;
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
      className={cx(
        'm-auto w-[calc(100%-1.5rem)] max-h-[92dvh] rounded-3xl border border-line bg-surface p-0 text-ink shadow-2xl',
        'backdrop:bg-black/50 backdrop:backdrop-blur-sm',
        wide ? 'max-w-3xl' : 'max-w-lg',
      )}
    >
      {open && (
        <div className="rise">
          <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-surface/95 px-6 py-4 backdrop-blur">
            <h2 className="font-display text-xl font-semibold">{title}</h2>
            <button type="button" onClick={onClose} className="rounded-full p-2 text-muted hover:bg-surface-2 hover:text-ink" aria-label="Close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </header>
          <div className="px-6 py-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}

export function Icon({ name, size = 18 }: { name: 'plus' | 'refresh' | 'sun' | 'moon' | 'grid' | 'list' | 'search' | 'edit' | 'trash' | 'back' | 'cube' | 'spin'; size?: number }) {
  const p = {
    plus: 'M12 5v14M5 12h14',
    refresh: 'M20 11a8 8 0 10-2.3 5.7M20 4v7h-7',
    sun: 'M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6L4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 17a5 5 0 100-10 5 5 0 000 10z',
    moon: 'M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z',
    grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
    search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4',
    edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
    trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
    back: 'M15 18l-6-6 6-6',
    cube: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5',
    spin: 'M12 3a9 9 0 109 9',
  }[name];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={name === 'spin' ? 'animate-spin' : undefined}>
      <path d={p} />
    </svg>
  );
}
