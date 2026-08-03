import React from 'react';
import {
  MessageSquare,
  Zap,
  Megaphone,
  Cpu,
  UserCheck,
  Search,
  Sun,
  Moon,
  ShieldAlert
} from 'lucide-react';

export default function SidebarNav({
  activeView,
  onSelectView,
  onOpenModal,
  theme,
  onToggleTheme,
  hasCheckpoint = false
}) {
  return (
    <aside className="w-14 bg-slate-950 border-r border-slate-800/80 flex flex-col items-center py-3 justify-between shrink-0 select-none z-20">
      {/* App Logo */}
      <div className="flex flex-col items-center gap-5">
        <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center tracking-tight">
          FB
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-col items-center gap-1.5">
          {/* Chat Inbox */}
          <button
            onClick={() => onSelectView('chat')}
            title="Hội thoại Chat"
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
              activeView === 'chat'
                ? 'bg-slate-800 text-white font-semibold'
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
            }`}
          >
            <MessageSquare size={17} />
          </button>

          {/* Quick Search */}
          <button
            onClick={() => onOpenModal('search')}
            title="Tìm kiếm FTS5 (Ctrl+K)"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-slate-200 transition-colors"
          >
            <Search size={17} />
          </button>

          {/* Auto Reply */}
          <button
            onClick={() => onOpenModal('autoReply')}
            title="Trả lời Tự động"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-slate-200 transition-colors"
          >
            <Zap size={17} />
          </button>

          {/* Broadcast */}
          <button
            onClick={() => onOpenModal('broadcast')}
            title="Gửi tin hàng loạt Broadcast"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-slate-200 transition-colors"
          >
            <Megaphone size={17} />
          </button>

          {/* Dual AI Config */}
          <button
            onClick={() => onOpenModal('aiConfig')}
            title="Cấu hình Dual-AI Engine"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-slate-200 transition-colors"
          >
            <Cpu size={17} />
          </button>

          {/* Account Manager & Checkpoint */}
          <button
            onClick={() => onOpenModal('accounts')}
            title="Quản lý Tài khoản & Checkpoint"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-slate-200 transition-colors relative"
          >
            {hasCheckpoint ? (
              <ShieldAlert size={17} className="text-red-400" />
            ) : (
              <UserCheck size={17} />
            )}
            {hasCheckpoint && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </button>
        </nav>
      </div>

      {/* Bottom controls: Theme toggle */}
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={onToggleTheme}
          title={`Chuyển giao diện (${theme === 'dark' ? 'Sáng' : 'Tối'})`}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-slate-200 transition-colors"
        >
          {theme === 'dark' ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} />}
        </button>
      </div>
    </aside>
  );
}
