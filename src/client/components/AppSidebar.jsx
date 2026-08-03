import React from 'react';
import { MessageSquare, Search, Zap, Megaphone, Cpu, UserCheck, ShieldAlert, ChevronLeft, ChevronRight, Sun, Moon } from 'lucide-react';

const ICON_SIZE = 18;
const ICON_STROKE = 1.75;
const BTN_SIZE = 36;

export default function AppSidebar({ activeView, onSelectView, onOpenModal, theme, onToggleTheme, hasCheckpoint = false, collapsed = false, onToggleCollapse }) {
  const navItems = [
    { id: 'chat', label: 'Hội thoại', icon: MessageSquare },
    { id: 'search', label: 'Tìm kiếm', icon: Search, isModal: true },
    { id: 'autoReply', label: 'Tự động hóa', icon: Zap, isModal: true },
    { id: 'broadcast', label: 'Chiến dịch', icon: Megaphone, isModal: true },
    { id: 'aiConfig', label: 'Cài đặt AI', icon: Cpu, isModal: true },
    { id: 'accounts', label: 'Quản lý', icon: UserCheck, isModal: true }
  ];

  return (
    <aside className="w-[var(--sidebar-width)] h-full bg-[var(--color-bg-sidebar)] border-r border-[var(--color-border)] flex flex-col items-center py-3 shrink-0 select-none z-[var(--z-sticky)]">
      {/* Logo */}
      <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)] text-[var(--color-text-on-accent)] font-bold text-xs flex items-center justify-center mb-5">FB</div>

      {/* Nav Buttons */}
      <nav className="flex flex-col items-center gap-1 w-full px-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = !item.isModal && activeView === item.id;
          const isCheckpointBtn = item.id === 'accounts' && hasCheckpoint;

          return (
            <button
              key={item.id}
              onClick={() => item.isModal ? onOpenModal(item.id) : onSelectView(item.id)}
              title={item.label}
              style={{ minWidth: BTN_SIZE, minHeight: BTN_SIZE }}
              className={`group relative flex items-center justify-center rounded-lg linear-transition ${
                isActive
                  ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)] before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:bg-[var(--color-accent)] before:rounded-r'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {isCheckpointBtn ? (
                <ShieldAlert size={ICON_SIZE} strokeWidth={ICON_STROKE} className="text-[var(--color-danger)]" />
              ) : (
                <Icon size={ICON_SIZE} strokeWidth={ICON_STROKE} />
              )}

              {isCheckpointBtn && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-[var(--color-danger)] rounded-full" />
              )}

              {/* Tooltip */}
              <div className="absolute left-14 px-2 py-1 bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] text-xs rounded-md border border-[var(--color-border)] shadow-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none linear-transition z-[var(--z-tooltip)]">
                {item.label}
              </div>
            </button>
          );
        })}
      </nav>

      {/* Bottom Controls */}
      <div className="mt-auto flex flex-col items-center gap-1 w-full pt-3 border-t border-[var(--color-border)]">
        <button
          onClick={onToggleTheme}
          title={`Giao diện (${theme === 'dark' ? 'Sáng' : 'Tối'})`}
          style={{ minWidth: BTN_SIZE, minHeight: BTN_SIZE }}
          className="flex items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] linear-transition"
        >
          {theme === 'dark'
            ? <Sun size={ICON_SIZE} strokeWidth={ICON_STROKE} className="text-[var(--color-warning)]" />
            : <Moon size={ICON_SIZE} strokeWidth={ICON_STROKE} />
          }
        </button>

        <div title="Tài khoản Admin" className="w-7 h-7 rounded-full bg-[var(--color-bg-hover)] border border-[var(--color-border)] text-[var(--color-text-primary)] font-medium text-xs flex items-center justify-center">
          AD
        </div>

        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            title={collapsed ? 'Mở rộng bảng Lead' : 'Thu gọn bảng Lead'}
            style={{ minWidth: BTN_SIZE, minHeight: BTN_SIZE }}
            className="flex items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] linear-transition"
          >
            {collapsed ? <ChevronRight size={ICON_SIZE} strokeWidth={ICON_STROKE} /> : <ChevronLeft size={ICON_SIZE} strokeWidth={ICON_STROKE} />}
          </button>
        )}
      </div>
    </aside>
  );
}
