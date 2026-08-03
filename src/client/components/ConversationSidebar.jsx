import React, { useState, useEffect } from 'react';
import { Search, Edit, Filter, ChevronDown } from 'lucide-react';
import ConversationFilters from './ConversationFilters.jsx';
import ConversationItem from './ConversationItem.jsx';
import EmptyState from './EmptyState.jsx';

export default function ConversationSidebar({
  threads = [], activeThreadId, onSelectThread,
  activeTab, onTabChange, searchQuery, onSearchChange, isConnected, onOpenSearch,
  accounts = []
}) {
  const [selectedAccountId, setSelectedAccountId] = useState('ALL');
  const shouldShowAccountFilter = accounts.length > 1;

  const filteredThreads = threads.filter((thread) => {
    if (selectedAccountId !== 'ALL' && String(thread.account_id) !== String(selectedAccountId)) return false;
    if (activeTab === 'ASSIGNED' && thread.status !== 'ASSIGNED') return false;
    if (activeTab === 'UNPROCESSED' && thread.status !== 'UNPROCESSED') return false;
    if (activeTab === 'COMPLETED' && thread.status !== 'COMPLETED') return false;

    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return `${thread.contact_name || ''} ${thread.last_message || ''}`.toLowerCase().includes(query);
  });

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
      event.preventDefault();
      if (filteredThreads.length === 0) return;

      const currentIndex = filteredThreads.findIndex((thread) => String(thread.id) === String(activeThreadId));
      const nextIndex = event.key === 'ArrowUp'
        ? (currentIndex > 0 ? currentIndex - 1 : filteredThreads.length - 1)
        : (currentIndex < filteredThreads.length - 1 ? currentIndex + 1 : 0);
      onSelectThread(filteredThreads[nextIndex].id);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredThreads, activeThreadId, onSelectThread]);

  return (
    <aside className="w-[var(--conversation-width)] min-w-[var(--conversation-width)] max-w-[var(--conversation-width)] bg-[var(--color-bg-panel)] border-r border-[var(--color-border)] flex flex-col h-full min-h-0 max-h-full overflow-hidden shrink-0 select-none">
      <div className="px-4 pt-4 pb-3.5 bg-[var(--color-bg-panel)] border-b border-[var(--color-border)] shrink-0 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 bg-[var(--color-accent)] rounded-full flex items-center justify-center shadow-sm shrink-0">
              <span className="text-[var(--color-text-on-accent)] text-xs font-bold">M</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-[var(--color-text-primary)] truncate">MISSPRICE CRM</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[var(--color-success)]' : 'bg-[var(--color-danger)]'}`} />
                <span className="text-xs text-[var(--color-text-muted)]">Facebook ({accounts.length || 0})</span>
              </div>
            </div>
          </div>

          <div className="flex gap-1.5 shrink-0">
            <button onClick={onOpenSearch} className="p-1.5 hover:bg-[var(--color-bg-hover)] rounded-full transition-colors" title="Tìm kiếm nhanh" aria-label="Tìm kiếm nhanh">
              <Edit size={17} className="text-[var(--color-text-muted)]" strokeWidth={1.75} />
            </button>
            <button className="p-1.5 hover:bg-[var(--color-bg-hover)] rounded-full transition-colors" title="Bộ lọc" aria-label="Bộ lọc">
              <Filter size={17} className="text-[var(--color-text-muted)]" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {shouldShowAccountFilter && (
          <div className="relative">
            <select
              value={selectedAccountId}
              onChange={(event) => setSelectedAccountId(event.target.value)}
              className="w-full h-8 bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] text-xs font-medium pl-3 pr-8 rounded-full border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20 appearance-none cursor-pointer transition-all"
            >
              <option value="ALL" className="bg-[var(--color-bg-panel)] text-[var(--color-text-primary)]">Tất cả tài khoản Facebook</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id} className="bg-[var(--color-bg-panel)] text-[var(--color-text-primary)]">{account.name || account.id}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-2 pointer-events-none text-[var(--color-text-muted)]" strokeWidth={1.75} />
          </div>
        )}

        <div className="relative">
          <input
            type="text"
            placeholder="Tìm kiếm hội thoại..."
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            className="w-full h-9 pl-4 pr-10 bg-[var(--color-bg-surface)] rounded-full text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] border border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20 transition-all"
          />
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" strokeWidth={1.75} />
        </div>

        <ConversationFilters activeTab={activeTab} onTabChange={onTabChange} />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y bg-[var(--color-bg-panel)]">
        {filteredThreads.length === 0 ? (
          <EmptyState title="Không tìm thấy hội thoại" description="Thử đổi bộ lọc, tài khoản Facebook hoặc từ khóa tìm kiếm." />
        ) : (
          filteredThreads.map((thread) => (
            <ConversationItem
              key={thread.id}
              thread={thread}
              accounts={accounts}
              isSelected={String(thread.id) === String(activeThreadId)}
              onSelect={() => onSelectThread(thread.id)}
            />
          ))
        )}
      </div>
    </aside>
  );
}
