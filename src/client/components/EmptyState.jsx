import React from 'react';
import { MessageSquare, Inbox, Search, UserCheck } from 'lucide-react';

export default function EmptyState({ icon: Icon = MessageSquare, title, description }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none">
      <div className="w-10 h-10 rounded-lg bg-[var(--color-bg-panel)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] mb-3">
        <Icon size={18} strokeWidth={1.5} />
      </div>
      <h4 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">{title}</h4>
      {description && <p className="text-xs text-[var(--color-text-secondary)] max-w-xs leading-relaxed">{description}</p>}
    </div>
  );
}
