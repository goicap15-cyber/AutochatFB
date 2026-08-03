import React from 'react';

export default function ConversationFilters({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'ALL', label: 'Tất cả' },
    { id: 'ASSIGNED', label: 'Của tôi' },
    { id: 'UNPROCESSED', label: 'Chưa xử lý' },
    { id: 'COMPLETED', label: 'Đã chốt' }
  ];

  return (
    <div className="flex gap-1.5 bg-[var(--color-bg-panel)] pt-1 pb-1">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 h-8.5 text-xs font-medium rounded-lg transition-colors truncate px-1 ${
              isActive
                ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)] font-semibold'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
