import React, { useEffect, useRef, useState } from 'react';
import { PhoneCall, PhoneOff, Check, X, Loader2, AlertCircle } from 'lucide-react';

// Auto-dismiss after 30 seconds of no interaction
const AUTO_DISMISS_MS = 30000;

export default function IncomingCallModal({ callInfo, onClose, onSelectThread, onAnswerCall }) {
  // ⚠️ Hooks must run unconditionally before any early return
  const timerRef = useRef(null);
  const [pendingAction, setPendingAction] = useState(null); // 'accept'|'decline'|null
  const [resultMsg, setResultMsg] = useState('');    // feedback text
  const [resultOk, setResultOk] = useState(null);   // true|false|null

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    // Reset state whenever a new call comes in
    setPendingAction(null);
    setResultMsg('');
    setResultOk(null);

    if (!callInfo) return;

    timerRef.current = setTimeout(() => {
      onClose?.();
    }, AUTO_DISMISS_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [callInfo, onClose]);

  if (!callInfo) return null;

  const handleAccept = (e) => {
    e.stopPropagation();
    if (pendingAction) return;
    setPendingAction('accept');
    setResultMsg('');
    setResultOk(null);

    if (callInfo.thread_id) {
      onSelectThread?.(callInfo.thread_id);
    }

    onAnswerCall?.('accept', callInfo.thread_id || callInfo.external_thread_id, (ok, msg) => {
      setPendingAction(null);
      setResultOk(ok);
      setResultMsg(msg || (ok ? 'Đã chấp nhận cuộc gọi' : 'Không thể chấp nhận, hãy bấm trực tiếp trên Messenger'));
      if (ok) setTimeout(() => onClose?.(), 1200);
    });

    // If no callback — just close after a moment
    setTimeout(() => {
      setPendingAction(null);
      onClose?.();
    }, 1500);
  };

  const handleDecline = (e) => {
    e.stopPropagation();
    if (pendingAction) return;
    setPendingAction('decline');
    setResultMsg('');
    setResultOk(null);

    onAnswerCall?.('decline', callInfo.thread_id || callInfo.external_thread_id, (ok, msg) => {
      setPendingAction(null);
      setResultOk(ok);
      setResultMsg(msg || (ok ? 'Đã từ chối cuộc gọi' : 'Không thể từ chối tự động — hãy bấm trực tiếp trên Messenger'));
      // Close after showing result
      setTimeout(() => onClose?.(), ok ? 1000 : 3000);
    });

    // If no callback — show feedback and close
    setTimeout(() => {
      setPendingAction(null);
      setResultOk(false);
      setResultMsg('Đã gửi lệnh từ chối đến Extension. Nếu cuộc gọi vẫn reo, hãy bấm từ chối trực tiếp trên tab Messenger.');
      setTimeout(() => onClose?.(), 3000);
    }, 1500);
  };

  const handleClose = (e) => {
    e.stopPropagation();
    onClose?.();
  };

  return (
    <div
      className="fixed top-5 right-5 z-[9999]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl shadow-2xl border border-white/20 min-w-[360px] max-w-[460px] overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          {/* Pulsing phone icon */}
          <div className="relative flex-shrink-0">
            {!pendingAction && (
              <div className="absolute -inset-2 rounded-full bg-emerald-500/40 animate-ping opacity-75" />
            )}
            <div className={`w-12 h-12 rounded-full text-white flex items-center justify-center shadow-lg relative z-10 ${
              pendingAction === 'decline' ? 'bg-rose-600' :
              pendingAction === 'accept' ? 'bg-emerald-600' : 'bg-emerald-500'
            }`}>
              {pendingAction
                ? <Loader2 size={22} className="animate-spin" />
                : <PhoneCall size={22} className="animate-bounce" />
              }
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full inline-block">
              📞 Cuộc gọi đang reo...
            </span>
            <h4 className="font-semibold text-sm truncate mt-1.5">
              {callInfo.caller_name || 'Khách hàng'}
            </h4>
            <p className="text-xs text-white/70 mt-0.5">
              Khách đang gọi đến trên Facebook Messenger
            </p>
          </div>

          {/* Close button */}
          <button
            onClick={handleClose}
            className="flex-shrink-0 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors flex items-center justify-center"
            title="Đóng thông báo"
          >
            <X size={14} />
          </button>
        </div>

        {/* Result feedback */}
        {resultMsg && (
          <div className={`mx-4 mb-3 px-3 py-2 rounded-lg text-xs flex items-start gap-2 ${
            resultOk === true
              ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300'
              : 'bg-amber-500/20 border border-amber-500/30 text-amber-300'
          }`}>
            <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
            <span>{resultMsg}</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="grid grid-cols-2 border-t border-white/10">
          <button
            onClick={handleAccept}
            disabled={!!pendingAction}
            className="flex items-center justify-center gap-2 py-3.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors select-none"
            style={{ touchAction: 'manipulation' }}
          >
            {pendingAction === 'accept'
              ? <Loader2 size={16} className="animate-spin" />
              : <Check size={18} strokeWidth={2.5} />
            }
            Chấp nhận
          </button>
          <button
            onClick={handleDecline}
            disabled={!!pendingAction}
            className="flex items-center justify-center gap-2 py-3.5 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors border-l border-white/10 select-none"
            style={{ touchAction: 'manipulation' }}
          >
            {pendingAction === 'decline'
              ? <Loader2 size={16} className="animate-spin" />
              : <PhoneOff size={18} strokeWidth={2.5} />
            }
            Từ chối
          </button>
        </div>
      </div>
    </div>
  );
}
