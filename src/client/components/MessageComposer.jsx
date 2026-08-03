import React, { useState } from 'react';
import { Send, Image, Paperclip, Smile, FileText, Loader2, AlertCircle, WifiOff, ThumbsUp } from 'lucide-react';

export default function MessageComposer({ onSendMessage, disabled = false }) {
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);

  const quickTemplates = [
    'Dạ chào bạn! Shop có thể hỗ trợ gì cho bạn ạ?',
    'Sản phẩm hiện đang có sẵn hàng, shop ship ngay trong ngày nha anh/chị!',
    'Bạn cho shop xin SĐT và địa chỉ để tạo đơn ngay nhé ạ!',
    'Shop xin cảm ơn và chúc bạn một ngày tốt lành!'
  ];

  const resizeInput = (target) => {
    target.style.height = 'auto';
    target.style.height = `${Math.min(Math.max(target.scrollHeight, 36), 132)}px`;
  };

  const handleSend = async (event) => {
    event?.preventDefault();
    if (!inputText.trim() || sending || disabled) return;

    const client_message_id = `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setSending(true);
    setError(null);
    try {
      await onSendMessage(inputText.trim(), client_message_id);
      setInputText('');
    } catch (err) {
      setError(err.message || 'Không gửi được tin nhắn');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend(event);
    }
  };

  const hasText = inputText.trim().length > 0;

  return (
    <div className="chat-composer px-4 pt-2.5 pb-2.5 bg-[var(--color-bg-panel)] border-t border-[var(--color-border)] select-none shrink-0 w-full sticky bottom-0">
      {disabled && (
        <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-danger-subtle)] border border-[var(--color-danger)]/20 rounded-lg text-xs font-medium text-[var(--color-danger)] mb-2.5">
          <WifiOff size={14} className="shrink-0" strokeWidth={1.75} />
          <span>Không thể gửi - account Facebook chưa kết nối</span>
        </div>
      )}

      {showTemplates && (
        <div className="p-2 bg-[var(--color-bg-panel)] rounded-xl border border-[var(--color-border)] space-y-1 text-xs mb-2.5 shadow-md">
          <div className="flex justify-between items-center text-xs text-[var(--color-text-muted)] font-medium pb-1 border-b border-[var(--color-border)]">
            <span>Mẫu nhanh</span>
            <button type="button" onClick={() => setShowTemplates(false)} className="hover:text-[var(--color-text-primary)] transition-colors">Đóng</button>
          </div>
          {quickTemplates.map((template) => (
            <button
              key={template}
              type="button"
              onClick={() => { setInputText(template); setShowTemplates(false); }}
              className="w-full text-left p-2 hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-lg transition-colors text-sm"
            >
              {template}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between px-3 py-2 bg-[var(--color-danger-subtle)] border border-[var(--color-danger)]/20 rounded-lg text-xs text-[var(--color-danger)] mb-2.5">
          <span className="flex items-center gap-1.5"><AlertCircle size={14} strokeWidth={1.75} /> {error}</span>
          <button type="button" onClick={() => setError(null)} className="text-xs underline">Đóng</button>
        </div>
      )}

      <form onSubmit={handleSend} className="flex items-end gap-2 bg-[var(--color-bg-surface)] rounded-2xl px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-[var(--color-accent)]/10 transition-all">
        <button type="button" title="Biểu tượng cảm xúc" className="w-8 h-8 inline-flex items-center justify-center hover:bg-[var(--color-bg-hover)] rounded-full transition-colors flex-shrink-0 text-[var(--color-warning)]">
          <Smile size={20} strokeWidth={1.75} />
        </button>
        <button type="button" title="Đính kèm tệp" className="w-8 h-8 inline-flex items-center justify-center hover:bg-[var(--color-bg-hover)] rounded-full transition-colors flex-shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
          <Paperclip size={19} strokeWidth={1.75} />
        </button>
        <button type="button" title="Đính kèm ảnh" className="w-8 h-8 inline-flex items-center justify-center hover:bg-[var(--color-bg-hover)] rounded-full transition-colors flex-shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
          <Image size={19} strokeWidth={1.75} />
        </button>
        <button type="button" title="Mẫu nhanh" onClick={() => setShowTemplates((value) => !value)} className="w-8 h-8 inline-flex items-center justify-center hover:bg-[var(--color-bg-hover)] rounded-full transition-colors flex-shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
          <FileText size={18} strokeWidth={1.75} />
        </button>

        <textarea
          rows={1}
          value={inputText}
          onChange={(event) => setInputText(event.target.value)}
          onInput={(event) => resizeInput(event.target)}
          onKeyDown={handleKeyDown}
          disabled={disabled || sending}
          placeholder={disabled ? 'Đã ngắt kết nối extension...' : 'Nhập tin nhắn...'}
          className="flex-1 bg-transparent text-sm focus:outline-none text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] resize-none disabled:opacity-50 leading-5 py-2 max-h-32 min-h-9"
          style={{ height: 36 }}
        />

        <button
          type="submit"
          disabled={!hasText || disabled || sending}
          className={`w-10 h-10 rounded-full transition-all flex-shrink-0 flex items-center justify-center ${
            hasText
              ? 'bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] shadow-sm'
              : 'text-[var(--color-accent)] disabled:opacity-100'
          }`}
          title="Gửi tin nhắn"
          aria-label="Gửi tin nhắn"
        >
          {sending ? <Loader2 size={18} className="animate-spin" /> : hasText ? <Send size={17} strokeWidth={1.8} /> : <ThumbsUp size={19} strokeWidth={1.8} />}
        </button>
      </form>
    </div>
  );
}
