import React, { useRef, useEffect } from 'react';
import MessageBubble from './MessageBubble.jsx';
import { MessageSquare, RefreshCw } from 'lucide-react';

function formatDate(value) {
  if (!value) return 'Hôm nay';
  const date = new Date(typeof value === 'number' ? value : value);
  const today = new Date().toLocaleDateString('vi-VN');
  const formatted = date.toLocaleDateString('vi-VN');
  return formatted === today ? 'Hôm nay' : formatted;
}

export default function MessageList({ messages = [], activeThread, onSyncThread, onRetryMessage }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' });
    }, 50);
    return () => clearTimeout(timer);
  }, [messages]);

  let lastDate = '';

  return (
    <div ref={containerRef} className="chat-messages bg-[var(--color-bg-app)] flex-1 overflow-y-auto px-4 py-5">
      <div className="chat-content-wrapper relative max-w-3xl mx-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center select-none min-h-[360px]">
            <div className="w-14 h-14 rounded-full bg-[var(--color-bg-panel)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] mb-3 shadow-sm">
              <MessageSquare size={26} strokeWidth={1.5} />
            </div>
            <h4 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">Chưa có tin nhắn</h4>
            <p className="text-sm text-[var(--color-text-secondary)] max-w-xs mb-3 leading-relaxed">
              Hội thoại này chưa có nội dung hoặc dữ liệu chưa được đồng bộ từ Facebook.
            </p>
            {onSyncThread && (
              <button
                type="button"
                onClick={onSyncThread}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] text-sm font-medium rounded-full transition-colors shadow-sm"
              >
                <RefreshCw size={14} strokeWidth={1.75} />
                <span>Đồng bộ lại hội thoại</span>
              </button>
            )}
          </div>
        ) : (
          <div className="py-2 space-y-4">
            {activeThread?.sync_status === 'PARTIAL' && (
              <div className="flex items-center justify-center gap-2 text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-panel)] border border-[var(--color-border)] rounded-full px-3 py-1.5 mx-auto w-fit">
                <RefreshCw size={12} strokeWidth={1.75} className="animate-spin" />
                <span>Đang tải thêm lịch sử cũ hơn…</span>
              </div>
            )}
            {messages.map((msg, index) => {
              const dateLabel = formatDate(msg.timestamp_ms || msg.created_at || msg.time);
              const showDateDivider = dateLabel !== lastDate;
              if (showDateDivider) lastDate = dateLabel;

              return (
                <div key={msg.id || msg.client_message_id || `${msg.fb_message_id}-${msg.created_at || msg.time || index}`}>
                  {showDateDivider && (
                    <div className="flex items-center gap-3 my-3">
                      <div className="flex-1 h-px bg-[var(--color-border)]" />
                      <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-app)] px-2 font-medium">
                        {dateLabel}
                      </span>
                      <div className="flex-1 h-px bg-[var(--color-border)]" />
                    </div>
                  )}
                  <MessageBubble msg={msg} activeThread={activeThread} onRetry={onRetryMessage} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
