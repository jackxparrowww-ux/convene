'use client';

/** Small shared UI primitives: avatar, confirm dialog, toasts. */

import { useEffect, useRef } from 'react';
import { XIcon, AlertIcon } from './icons';
import type { Toast } from '@/hooks/useMeeting';

const AVATAR_HUES = [348, 265, 210, 160, 25, 190, 300, 120];

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function hueOf(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_HUES[h % AVATAR_HUES.length];
}

export function Avatar({
  name,
  size = 44,
  className = '',
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const hue = hueOf(name || '?');
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(135deg, hsl(${hue} 45% 38%), hsl(${hue} 50% 26%))`,
      }}
      aria-hidden="true"
    >
      {initialsOf(name || '?')}
    </span>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      confirmRef.current?.focus();
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onCancel();
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 animate-fade-in"
      onClick={onCancel}
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-ink-900 p-6 shadow-pop animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand">
          <AlertIcon size={20} />
        </div>
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{body}</p>
        <div className="mt-6 flex justify-end gap-2.5">
          <button
            onClick={onCancel}
            className="rounded-full px-5 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className={`rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-all active:scale-[0.98] ${
              danger
                ? 'bg-brand hover:bg-brand-deep'
                : 'bg-ink-700 hover:bg-ink-700/80'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ToastStack({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="pointer-events-none fixed bottom-24 left-4 z-[70] flex flex-col gap-2 md:bottom-8">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex max-w-xs items-center gap-2.5 rounded-xl border border-white/10 bg-ink-850/95 py-2.5 pl-3 pr-4 text-sm text-zinc-200 shadow-pop backdrop-blur animate-toast-in"
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function IconButton({
  label,
  onClick,
  active = false,
  danger = false,
  disabled = false,
  badge,
  children,
  size = 'md',
}: {
  label: string;
  onClick?: () => void;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  badge?: number;
  children: React.ReactNode;
  size?: 'md' | 'lg';
}) {
  const dims = size === 'lg' ? 'h-12 w-12' : 'h-11 w-11';
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`relative flex ${dims} items-center justify-center rounded-full transition-all duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 ${
        danger
          ? 'bg-brand text-white hover:bg-brand-deep'
          : active
            ? 'bg-brand-soft text-brand ring-1 ring-brand/50'
            : 'bg-ink-700 text-zinc-200 hover:bg-ink-700/70 hover:text-white'
      }`}
    >
      {children}
      {badge !== undefined && badge > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );
}

export function CloseButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-white/[0.07] hover:text-white"
    >
      <XIcon size={16} />
    </button>
  );
}
