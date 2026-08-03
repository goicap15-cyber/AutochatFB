import React, { useState, useEffect } from 'react';
import { X, Megaphone, Send, StopCircle } from 'lucide-react';

export default function BroadcastModal({ accountId = '100088912345678', threads = [], socket, onClose }) {
  const [quota, setQuota] = useState({ used: 0, remaining: 150, limit: 150 });
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState(null);
  const [campaignId, setCampaignId] = useState(null);

  useEffect(() => {
    fetch(`/api/accounts/${accountId}/broadcast/quota`)
      .then(r => r.json())
      .then(setQuota)
      .catch(console.error);
  }, [accountId]);

  useEffect(() => {
    if (!socket) return;
    socket.on('BROADCAST_PROGRESS', (data) => {
      setProgress(data);
      if (data.status === 'COMPLETED' || data.status === 'PARTIAL') {
        setIsSending(false);
      }
    });
    return () => socket.off('BROADCAST_PROGRESS');
  }, [socket]);

  const handleStartBroadcast = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    const threadIds = threads.map(t => t.id);
    setIsSending(true);

    try {
      const res = await fetch(`/api/accounts/${accountId}/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thread_ids: threadIds, message })
      });
      const data = await res.json();
      if (data.campaignId) setCampaignId(data.campaignId);
    } catch (err) {
      console.error(err);
      setIsSending(false);
    }
  };

  const handleCancelBroadcast = async () => {
    if (!campaignId) return;
    await fetch(`/api/broadcast/${campaignId}/cancel`, { method: 'POST' });
    setIsSending(false);
  };

  const percent = progress && progress.total > 0 ? Math.round((progress.sent / progress.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Megaphone size={18} className="text-slate-300" />
            <h3 className="text-xs font-semibold text-slate-100 uppercase tracking-wider">Gửi tin hàng loạt Broadcast An Toàn</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Quota Banner */}
          <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 font-medium">Giới hạn an toàn (Quota 24h):</span>
              <div className="text-sm font-semibold text-slate-100 mt-0.5">
                Còn lại {quota.remaining} / {quota.limit} tin nhắn
              </div>
            </div>
            <span className="text-[10px] text-slate-400 border border-slate-800 px-2 py-1 rounded">
              Random Delay 15s - 45s
            </span>
          </div>

          {/* Form Broadcast */}
          <form onSubmit={handleStartBroadcast} className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-slate-400 font-medium">Nội dung tin nhắn ({threads.length} khách hàng):</label>
                <button
                  type="button"
                  onClick={() => setMessage(prev => prev + '{ten_khach_hang}')}
                  className="text-[11px] text-blue-400 hover:underline font-medium"
                >
                  + Chèn {'{ten_khach_hang}'}
                </button>
              </div>
              <textarea
                rows={4}
                disabled={isSending}
                placeholder="Nhập nội dung chiến dịch broadcast..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full bg-slate-950 text-slate-100 text-xs p-3 rounded-md border border-slate-800 focus:outline-none focus:border-slate-700 resize-none disabled:opacity-50"
              />
            </div>

            {/* Realtime Progress Bar */}
            {isSending && progress && (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-md space-y-1.5">
                <div className="flex justify-between text-xs text-slate-300 font-medium">
                  <span>Đang gửi chiến dịch...</span>
                  <span>{progress.sent} / {progress.total} ({percent}%)</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-blue-600 h-full transition-all duration-200" style={{ width: `${percent}%` }} />
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              {isSending ? (
                <button
                  type="button"
                  onClick={handleCancelBroadcast}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white font-medium text-xs rounded-md transition-colors flex items-center justify-center gap-1.5"
                >
                  <StopCircle size={14} /> Huỷ Chiến Dịch
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!message.trim() || quota.remaining <= 0}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-medium text-xs rounded-md transition-colors flex items-center justify-center gap-1.5"
                >
                  <Send size={14} /> Bắt Đầu Gửi Broadcast
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/40 text-right">
          <button onClick={onClose} className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-xs font-medium border border-slate-700/60">
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
