import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { createPortal } from 'react-dom';

export function ConfirmDialog({ isOpen, title, description, confirmLabel = 'Xác nhận', tone = 'danger', onConfirm, onClose }) {
  const cancelRef = useRef(null);
  const confirmRef = useRef(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isDanger = tone === 'danger';

  useEffect(() => {
    if (!isOpen) setIsSubmitting(false);
  }, [isOpen]);

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onConfirm?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    const timer = window.setTimeout(() => (isDanger ? cancelRef : confirmRef).current?.focus(), 0);
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !isSubmitting) onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, isDanger, isSubmitting, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;
  const Icon = isDanger ? AlertTriangle : Info;
  const iconClass = isDanger
    ? 'bg-[var(--color-danger-subtle)] text-[var(--color-danger)]'
    : 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]';
  const confirmClass = isDanger
    ? 'bg-[var(--color-danger)] hover:brightness-95'
    : 'bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)]';

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => { if (!isSubmitting && event.target === event.currentTarget) onClose?.(); }}
      role="presentation"
    >
      <section role="alertdialog" aria-modal="true" aria-labelledby="crm-confirm-title" aria-describedby="crm-confirm-description" className="w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-panel)] shadow-2xl">
        <div className="flex items-start gap-3 p-5">
          <span className={'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ' + iconClass}><Icon size={20} strokeWidth={2} /></span>
          <div className="min-w-0 pr-2">
            <h2 id="crm-confirm-title" className="text-base font-bold text-[var(--color-text-primary)]">{title}</h2>
            <p id="crm-confirm-description" className="mt-1.5 text-sm leading-6 text-[var(--color-text-secondary)]">{description}</p>
          </div>
          <button type="button" onClick={onClose} disabled={isSubmitting} className="-mr-1 -mt-1 rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]" aria-label="Đóng"><X size={17} /></button>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] bg-[var(--color-bg-surface)] px-5 py-3.5">
          <button ref={cancelRef} type="button" onClick={onClose} disabled={isSubmitting} className="h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-panel)] px-3.5 text-sm font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]">Hủy</button>
          <button ref={confirmRef} type="button" onClick={handleConfirm} disabled={isSubmitting} className={'h-9 rounded-lg px-3.5 text-sm font-bold text-[var(--color-text-on-accent)] shadow-sm transition-colors ' + confirmClass}>{isSubmitting ? 'Đang xử lý…' : confirmLabel}</button>
        </div>
      </section>
    </div>,
    document.body
  );
}

export function Toast({ notice, onDismiss }) {
  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(onDismiss, 4200);
    return () => window.clearTimeout(timer);
  }, [notice, onDismiss]);

  if (!notice || typeof document === 'undefined') return null;
  const isError = notice.tone === 'error';
  const Icon = isError ? AlertTriangle : CheckCircle2;
  const colors = isError
    ? 'border-[var(--color-danger)]/25 bg-[var(--color-danger-subtle)] text-[var(--color-danger)]'
    : 'border-[var(--color-success)]/25 bg-[var(--color-success-subtle)] text-[var(--color-success)]';
  return createPortal(
    <div role="status" aria-live="polite" className={'fixed bottom-5 right-5 z-[101] flex max-w-sm items-start gap-2.5 rounded-xl border px-3.5 py-3 shadow-xl ' + colors}>
      <Icon size={18} className="mt-0.5 shrink-0" />
      <p className="flex-1 text-sm font-medium leading-5">{notice.message}</p>
      <button type="button" onClick={onDismiss} className="rounded p-0.5 hover:bg-black/5" aria-label="Đóng thông báo"><X size={15} /></button>
    </div>,
    document.body
  );
}
