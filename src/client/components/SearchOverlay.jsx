import React, { useState, useEffect, useRef } from 'react';
import { Search, X, MessageSquare } from 'lucide-react';

export default function SearchOverlay({ onClose, onSelectThread }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=20`);
        const data = await res.json();
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 flex items-start justify-center pt-20"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl mx-4 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
          <Search className="text-slate-400 shrink-0" size={18} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Tìm kiếm nội dung tin nhắn (FTS5)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-slate-100 text-xs focus:outline-none placeholder-slate-500"
          />
          {loading && (
            <span className="text-[11px] text-slate-500">Đang tìm...</span>
          )}
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1">
            <X size={16} />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto divide-y divide-slate-800/60">
          {results.length === 0 && query.trim().length >= 2 && !loading && (
            <div className="p-6 text-center text-slate-500 text-xs">
              Không tìm thấy kết quả nào cho "{query}"
            </div>
          )}

          {query.trim().length < 2 && (
            <div className="p-6 text-center text-slate-500 text-xs">
              Nhập từ khóa để tìm kiếm...
              <div className="mt-1 text-[10px] text-slate-600">Phím tắt: Ctrl + K</div>
            </div>
          )}

          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => onSelectThread(r.thread_id)}
              className="w-full text-left p-3.5 hover:bg-slate-800/50 transition-colors flex gap-3 items-start"
            >
              <div className="w-7 h-7 rounded-full bg-slate-800 text-slate-300 font-semibold text-xs flex items-center justify-center shrink-0 border border-slate-700/50">
                {(r.contact_name || 'K').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-semibold text-slate-200">{r.contact_name || 'Khách hàng'}</span>
                  <span className="text-[10px] text-slate-500 shrink-0 ml-2">
                    {r.created_at ? new Date(r.created_at).toLocaleDateString('vi') : ''}
                  </span>
                </div>
                <p
                  className="text-xs text-slate-400 truncate"
                  dangerouslySetInnerHTML={{
                    __html: (r.highlight || r.content || '').replace(
                      /<mark>/g, '<mark class="bg-amber-500/20 text-amber-200 rounded px-0.5">'
                    )
                  }}
                />
              </div>
              <MessageSquare className="text-slate-600 shrink-0 mt-0.5" size={13} />
            </button>
          ))}
        </div>

        {results.length > 0 && (
          <div className="px-4 py-2 border-t border-slate-800 text-[10px] text-slate-500 text-right">
            {results.length} kết quả · SQLite FTS5
          </div>
        )}
      </div>
    </div>
  );
}
