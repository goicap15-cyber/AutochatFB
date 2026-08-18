import React, { Suspense, lazy, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

const EmojiPicker = lazy(() => import('emoji-picker-react'));

export default function EmojiPickerPopover({
  open,
  onClose,
  onSelect,
  triggerRef
}) {
  const popoverRef = useRef(null);

  useEffect(() => {
    if (open === false) return undefined;

    const handlePointerDown = (event) => {
      if (
        popoverRef.current?.contains(event.target) ||
        triggerRef?.current?.contains(event.target)
      ) return;
      onClose({ restoreFocus: false });
    };
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onClose({ restoreFocus: true });
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown, true);
    requestAnimationFrame(() => popoverRef.current?.focus());
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [open, onClose, triggerRef]);

  if (open === false) return null;

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Chọn biểu tượng cảm xúc"
      tabIndex={-1}
      className="absolute bottom-[calc(100%+12px)] left-0 z-50 w-[min(350px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-panel)] shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40"
    >
      <Suspense
        fallback={(
          <div className="flex h-80 items-center justify-center gap-2 text-sm text-[var(--color-text-muted)]">
            <Loader2 size={18} className="animate-spin motion-reduce:animate-none" />
            Đang tải emoji...
          </div>
        )}
      >
        <EmojiPicker
          width="100%"
          height={380}
          lazyLoadEmojis
          emojiStyle="native"
          searchPlaceHolder="Tìm emoji..."
          skinTonesDisabled={false}
          previewConfig={{ showPreview: false }}
          onEmojiClick={(emojiData) => onSelect(emojiData.emoji)}
        />
      </Suspense>
    </div>
  );
}
