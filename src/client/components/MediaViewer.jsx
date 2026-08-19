import React, { useState } from 'react';
import { Volume2, FileText, Download, X } from 'lucide-react';

export default function MediaViewer({ mediaType, mediaUrl, localMediaPath }) {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const displayUrl = localMediaPath || mediaUrl;

  if (!displayUrl) return null;

  const isImg = mediaType === 'image' ||
    /\.(png|jpg|jpeg|webp|gif|bmp)(\?.*)?$/i.test(displayUrl) ||
    (typeof displayUrl === 'string' && (
      displayUrl.includes('/outbound-attachments/') ||
      displayUrl.includes('/campaign-attachments/') ||
      displayUrl.startsWith('data:image/')
    ));

  if (isImg) {
    return (
      <div className="my-0.5">
        <img
          src={displayUrl}
          alt="Attachment"
          className="max-w-xs max-h-60 rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity border border-[var(--color-border)]"
          onClick={() => setIsLightboxOpen(true)}
        />

        {isLightboxOpen && (
          <div
            className="fixed inset-0 bg-[var(--color-overlay)] z-50 flex items-center justify-center p-4 fade-in"
            onClick={() => setIsLightboxOpen(false)}
          >
            <div className="relative max-w-4xl max-h-[90vh]">
              <button
                className="absolute -top-10 right-0 text-[var(--color-text-on-accent)] hover:text-[var(--color-danger)] p-2"
                onClick={() => setIsLightboxOpen(false)}
                aria-label="Đóng ảnh"
              >
                <X size={24} />
              </button>
              <img src={displayUrl} alt="Enlarged view" className="max-w-full max-h-[85vh] rounded-lg shadow-2xl" />
            </div>
          </div>
        )}
      </div>
    );
  }

  if (mediaType === 'video') {
    return (
      <div className="mt-2 max-w-xs">
        <video controls className="w-full rounded-lg border border-[var(--color-border)] shadow-sm">
          <source src={displayUrl} />
          Trình duyệt không hỗ trợ phát video này.
        </video>
      </div>
    );
  }

  if (mediaType === 'voice') {
    return (
      <div className="mt-2 p-3 bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border)] flex items-center gap-3 max-w-xs">
        <Volume2 className="text-[var(--color-accent)]" size={20} strokeWidth={1.75} />
        <audio controls className="w-full h-8">
          <source src={displayUrl} />
          Trình duyệt không hỗ trợ phát voice note.
        </audio>
      </div>
    );
  }

  return (
    <div className="mt-2 p-3 bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border)] flex items-center justify-between gap-3 max-w-xs">
      <div className="flex items-center gap-2 overflow-hidden">
        <FileText className="text-[var(--color-text-muted)] shrink-0" size={20} strokeWidth={1.75} />
        <span className="text-xs text-[var(--color-text-secondary)] truncate">Tệp đính kèm</span>
      </div>
      <a
        href={displayUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="p-1.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] rounded-md transition-colors"
        aria-label="Tải tệp"
      >
        <Download size={14} strokeWidth={1.75} />
      </a>
    </div>
  );
}
