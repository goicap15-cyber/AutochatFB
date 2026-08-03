import React from 'react';

const statusStyles = {
  NEW: 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)] border-[var(--color-accent)]/20',
  CONTACTED: 'bg-[var(--color-warning-subtle)] text-[var(--color-warning)] border-[var(--color-warning)]/20',
  QUALIFIED: 'bg-[var(--color-success-subtle)] text-[var(--color-success)] border-[var(--color-success)]/20',
  UNPROCESSED: 'bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] border-[var(--color-border)]',
  ASSIGNED: 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)] border-[var(--color-accent)]/20',
  COMPLETED: 'bg-[var(--color-success-subtle)] text-[var(--color-success)] border-[var(--color-success)]/20',
  AI_ACTIVE: 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)] border-[var(--color-accent)]/20',
  AI_PAUSED: 'bg-[var(--color-warning-subtle)] text-[var(--color-warning)] border-[var(--color-warning)]/20',
  ACTIVE: 'bg-[var(--color-success-subtle)] text-[var(--color-success)] border-[var(--color-success)]/20',
  CHECKPOINT: 'bg-[var(--color-danger-subtle)] text-[var(--color-danger)] border-[var(--color-danger)]/20',
  DISCONNECTED: 'bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] border-[var(--color-border)]'
};

export default function StatusBadge({ type, label, size = 'sm' }) {
  const badgeStyle = statusStyles[type] || statusStyles.DISCONNECTED;
  const sizeClass = size === 'xs' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-0.5';

  return (
    <span className={`inline-flex items-center gap-1 font-medium rounded border ${badgeStyle} ${sizeClass}`}>
      {label}
    </span>
  );
}
