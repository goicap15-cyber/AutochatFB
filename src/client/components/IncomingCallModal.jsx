import React, { useEffect } from 'react';
import { PhoneCall, PhoneOff, Check, X } from 'lucide-react';

export default function IncomingCallModal({ callInfo, onClose, onSelectThread, onAnswerCall }) {
  if (!callInfo) return null;

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose?.();
    }, 30000);
    return () => clearTimeout(timer);
  }, [callInfo, onClose]);

  const handleAccept = () => {
    if (callInfo.thread_id) {
      onSelectThread?.(callInfo.thread_id);
    }
    onAnswerCall?.('accept', callInfo.thread_id || callInfo.external_thread_id);
    onClose?.();
  };

  const handleDecline = () => {
    onAnswerCall?.('decline', callInfo.thread_id || callInfo.external_thread_id);
    onClose?.();
  };

  return (
    <div className="fixed top-5 right-5 z-[9999]">
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 shadow-2xl border border-white/20 flex items-center gap-4 min-w-[340px] max-w-[440px]">
        <div className="relative flex-shrink-0">
          <div className="absolute -inset-1.5 rounded-full bg-emerald-500/40 animate-ping opacity-75"></div>
          <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg relative z-10">
            <PhoneCall size={24} className="animate-bounce" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
              📞 Cuộc gọi đang reo...
            </span>
            <button onClick={onClose} className="text-white/60 hover:text-white transition-colors p-1" title="Đóng">
              <X size={16} />
            </button>
          </div>
          <h4 className="font-semibold text-sm truncate mt-1.5">
            {callInfo.caller_name || 'Khách hàng'}
          </h4>
          <p className="text-xs text-white/70 mt-0.5">
            Khách đang gọi đến trên Facebook Messenger
          </p>

          <div className="flex items-center gap-2 mt-3.5">
            <button
              onClick={handleAccept}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
            >
              <Check size={16} />
              Chấp nhận
            </button>
            <button
              onClick={handleDecline}
              className="flex-1 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
            >
              <PhoneOff size={16} />
              Từ chối
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
