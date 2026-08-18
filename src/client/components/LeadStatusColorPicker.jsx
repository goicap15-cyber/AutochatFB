import React, { useState, useEffect, useRef, useCallback, useId } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Check, X } from 'lucide-react';
import { normalizeHexColor, isValidHexColor, getContrastTextColor } from '../utils/color.js';

/**
 * LeadStatusColorPicker
 *
 * Contract:
 * - value: committed canonical hex color (e.g. '#2684FF')
 * - onApply: function(canonicalHex) - commits the draft color
 * - onCancel: function() - closes and discards draft
 * - triggerRef: React.RefObject - focus returned on close
 */
export default function LeadStatusColorPicker({
  value = '#2684FF',
  onApply,
  onCancel,
  triggerRef
}) {
  const initialColor = normalizeHexColor(value) || '#2684FF';
  const [draftColor, setDraftColor] = useState(initialColor);
  const [hexInput, setHexInput] = useState(initialColor.replace('#', ''));
  const [inputError, setInputError] = useState(false);

  const containerRef = useRef(null);
  const hexInputRef = useRef(null);
  const errorId = useId();

  // Restore focus to trigger element on unmount/close
  const returnFocusToTrigger = useCallback(() => {
    if (triggerRef?.current && typeof triggerRef.current.focus === 'function') {
      // Small timeout ensures DOM transition finishes before focus
      setTimeout(() => {
        try {
          triggerRef.current?.focus();
        } catch (_) {}
      }, 0);
    }
  }, [triggerRef]);

  // Handle successful apply
  const handleApply = useCallback(() => {
    const normalized = normalizeHexColor(draftColor) || initialColor;
    returnFocusToTrigger();
    onApply?.(normalized);
  }, [draftColor, initialColor, onApply, returnFocusToTrigger]);

  // Handle cancel / discard
  const handleCancel = useCallback(() => {
    returnFocusToTrigger();
    onCancel?.();
  }, [onCancel, returnFocusToTrigger]);

  // Sync draft color when HexColorPicker changes
  const handlePickerChange = (newColor) => {
    const normalized = normalizeHexColor(newColor) || newColor.toUpperCase();
    setDraftColor(normalized);
    setHexInput(normalized.replace('#', ''));
    setInputError(false);
  };

  // Sync from text input to draft color
  const handleHexInputChange = (e) => {
    let raw = e.target.value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
    setHexInput(raw.toUpperCase());

    if (raw.length === 6) {
      const normalized = normalizeHexColor('#' + raw);
      if (normalized) {
        setDraftColor(normalized);
        setInputError(false);
      } else {
        setInputError(true);
      }
    } else {
      setInputError(raw.length > 0 && raw.length < 6);
    }
  };

  const handleHexInputBlur = () => {
    if (hexInput.length === 6 && /^[0-9A-Fa-f]{6}$/.test(hexInput)) {
      const normalized = normalizeHexColor('#' + hexInput);
      if (normalized) {
        setDraftColor(normalized);
        setHexInput(normalized.replace('#', ''));
        setInputError(false);
        return;
      }
    }
    // Revert to current draftColor if invalid on blur
    setHexInput(draftColor.replace('#', ''));
    setInputError(false);
  };

  // Keyboard navigation & Escape / Enter
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleCancel();
      } else if (e.key === 'Enter' && e.target === hexInputRef.current) {
        e.preventDefault();
        handleApply();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [handleApply, handleCancel]);

  // Outside click detection
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target) &&
        (!triggerRef?.current || !triggerRef.current.contains(e.target))
      ) {
        handleCancel();
      }
    };

    document.addEventListener('pointerdown', handleOutsideClick);
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
    };
  }, [handleCancel, triggerRef]);

  // Focus the hex input on mount for quick keyboard control
  useEffect(() => {
    const timer = setTimeout(() => {
      if (hexInputRef.current) {
        hexInputRef.current.focus();
        hexInputRef.current.select();
      }
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const contrastTextColor = getContrastTextColor(draftColor);
  const canApply = isValidHexColor('#' + hexInput);

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="false"
      aria-label="Bảng chọn màu trạng thái"
      className="mt-2 p-3 rounded-xl bg-[var(--color-bg-panel)] border border-[var(--color-border)] shadow-xl z-20 space-y-3 select-none text-[var(--color-text-primary)]"
      style={{ maxWidth: '100%' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[var(--color-text-primary)]">
          Chọn màu trực quan
        </span>
        <button
          type="button"
          onClick={handleCancel}
          aria-label="Đóng bảng chọn màu"
          title="Đóng (Esc)"
          className="w-6 h-6 inline-flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
        >
          <X size={14} strokeWidth={2} />
        </button>
      </div>

      {/* Visual Color Picker (Saturation/Value Area + Hue Slider) */}
      <div className="custom-color-picker-wrapper overflow-hidden rounded-lg">
        <HexColorPicker
          color={draftColor}
          onChange={handlePickerChange}
          style={{ width: '100%', height: '140px' }}
        />
      </div>

      {/* Preview Swatch + Hex Input */}
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-lg border border-[var(--color-border)] shadow-inner flex items-center justify-center shrink-0 transition-colors"
          style={{ backgroundColor: draftColor }}
          title={`Màu đang chọn: ${draftColor}`}
          aria-label={`Màu đang chọn: ${draftColor}`}
        >
          <span
            className="text-[10px] font-bold"
            style={{ color: contrastTextColor }}
          >
            Aa
          </span>
        </div>

        <div className="relative flex-1 min-w-0">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--color-text-muted)] select-none">
            #
          </span>
          <input
            ref={hexInputRef}
            type="text"
            value={hexInput}
            onChange={handleHexInputChange}
            onBlur={handleHexInputBlur}
            maxLength={6}
            placeholder="RRGGBB"
            aria-label="Mã màu HEX (6 ký tự)"
            aria-invalid={inputError}
            aria-describedby={inputError ? errorId : undefined}
            className={`w-full pl-6 pr-2.5 py-1.5 bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] font-mono text-xs font-semibold rounded-lg border focus:outline-none transition-colors ${
              inputError
                ? 'border-[var(--color-danger)] focus:ring-1 focus:ring-[var(--color-danger)]'
                : 'border-[var(--color-border)] focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]'
            }`}
          />
        </div>
      </div>
      {inputError && (
        <p id={errorId} role="alert" className="text-[11px] text-[var(--color-danger)]">
          Nhập đủ 6 ký tự HEX, ví dụ 176CCD.
        </p>
      )}

      {/* Action Buttons: Áp dụng (Apply) & Hủy (Cancel) */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleApply}
          disabled={!canApply}
          className="flex-1 h-7 inline-flex items-center justify-center gap-1 text-xs font-semibold rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] shadow-sm transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
        >
          <Check size={13} strokeWidth={2.5} />
          Áp dụng
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="flex-1 h-7 inline-flex items-center justify-center text-xs font-semibold rounded-lg bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] border border-[var(--color-border)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
        >
          Hủy
        </button>
      </div>
    </div>
  );
}
