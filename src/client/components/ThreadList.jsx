import React from 'react';
import { Search, UserCheck, MessageSquare, CheckCircle, Clock } from 'lucide-react';

export default function ThreadList({
  threads,
  activeThreadId,
  onSelectThread,
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  isConnected,
  onOpenSearch
}) {
  const tabs = [
    { id: 'ALL', label: 'Tất cả', icon: MessageSquare },
    { id: 'ASSIGNED', label: 'Của tôi', icon: UserCheck },
    { id: 'UNPROCESSED', label: 'Chưa xử lý', icon: Clock },
    { id: 'COMPLETED', label: 'Đã chốt', icon: CheckCircle }
  ];

  const filteredThreads = threads.filter((t) => {
    if (activeTab === 'ASSIGNED' && t.status !== 'ASSIGNED') return false;
    if (activeTab === 'UNPROCESSED' && t.status !== 'UNPROCESSED') return false;
    if (activeTab === 'COMPLETED' && t.status !== 'COMPLETED') return false;
    if (searchQuery) {
      return (t.contact_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  return (
    <div className="w-[320px] bg-slate-900 border-r border-slate-800 flex flex-col h-full shrink-0 select-none">
      {/* Header & Search */}
      <div className="p-3 border-b border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Hội thoại Messenger</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenSearch}
              title="Tìm kiếm (Ctrl+K)"
              className="p-1 rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
            >
              <Search size={14} />
            </button>
            <span
              className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`}
              title={isConnected ? 'Đang kết nối WebSocket' : 'Mất kết nối'}
            />
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2 text-slate-500" size={14} />
          <input
            type="text"
            placeholder="Tìm kiếm..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-slate-950 text-slate-200 text-xs pl-8 pr-3 py-1.5 rounded-md border border-slate-800 focus:outline-none focus:border-slate-700"
          />
        </div>

        {/* Tabs Filter */}
        <div className="grid grid-cols-4 gap-0.5 bg-slate-950 p-0.5 rounded-md border border-slate-800">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`py-1 text-[11px] font-medium rounded text-center transition-colors truncate ${
                  isActive ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Threads List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
        {filteredThreads.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">Không tìm thấy hội thoại</div>
        ) : (
          filteredThreads.map((thread) => {
            const isSelected = thread.id === activeThreadId;
            return (
              <div
                key={thread.id}
                onClick={() => onSelectThread(thread.id)}
                className={`p-3 cursor-pointer transition-colors flex items-start gap-3 ${
                  isSelected
                    ? 'bg-slate-800/80 border-l-2 border-l-blue-500'
                    : 'hover:bg-slate-800/40'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 font-semibold text-xs flex items-center justify-center shrink-0 border border-slate-700/50">
                  {(thread.contact_name || 'K').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-semibold text-slate-200 truncate">
                      {thread.contact_name || 'Khách hàng FB'}
                    </span>
                    <span className="text-[10px] text-slate-500 shrink-0 ml-1">12:30</span>
                  </div>
                  <p className="text-xs text-slate-400 truncate leading-tight">{thread.last_message || 'Chưa có tin nhắn'}</p>
                </div>
                {thread.is_unread && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 mt-1.5" />}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
