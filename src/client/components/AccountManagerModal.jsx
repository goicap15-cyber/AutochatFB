import React, { useState, useEffect } from 'react';
import { X, ExternalLink, ShieldAlert, RefreshCw, PlusCircle } from 'lucide-react';

export default function AccountManagerModal({ onClose }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState(null);
  const [addingSession, setAddingSession] = useState(false);
  const [pendingKey, setPendingKey] = useState(null);

  const [initialAccountCount, setInitialAccountCount] = useState(null);

  const loadAccounts = async () => {
    try {
      const res = await fetch('/api/accounts');
      const data = await res.json();
      setAccounts(data);
    } catch {
      setAccounts([
        { id: '100088912345678', name: 'FB Sales 01', status: 'CHECKPOINT', broadcast_daily_count: 12 },
        { id: '100099876543210', name: 'FB CSKH 02', status: 'ACTIVE', broadcast_daily_count: 45 }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
    const interval = setInterval(loadAccounts, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (addingSession && accounts.length > 0) {
      if (initialAccountCount !== null && accounts.length > initialAccountCount) {
        setAddingSession(false);
        setPendingKey(null);
      }
    }
  }, [accounts, addingSession, initialAccountCount]);

  const handleStartChrome = async (accountId) => {
    setStartingId(accountId);
    try {
      await fetch(`/api/accounts/${accountId}/start`, { method: 'POST' });
      await loadAccounts();
    } catch (e) {
      console.error(e);
    } finally {
      setStartingId(null);
    }
  };

  const handleAddNewAccount = async () => {
    setInitialAccountCount(accounts.length);
    setAddingSession(true);
    try {
      const res = await fetch('/api/accounts/new-session', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setPendingKey(data.pending_key);
      } else {
        setAddingSession(false);
      }
    } catch (e) {
      console.error(e);
      setAddingSession(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldAlert size={18} className="text-slate-300" />
            <h3 className="text-xs font-semibold text-slate-100 uppercase tracking-wider">Quản lý Tài khoản Facebook & Checkpoint</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-400 leading-relaxed flex-1">
              Mở cửa sổ Chrome Portable để kết nối tài khoản mới hoặc xử lý Checkpoint/OTP 2FA.
            </p>
            <button
              onClick={handleAddNewAccount}
              disabled={addingSession}
              className="px-3 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50 text-[var(--color-text-on-accent)] rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors shadow-sm"
            >
              {addingSession ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Đang mở Chrome...</span>
                </>
              ) : (
                <>
                  <PlusCircle size={15} />
                  <span>+ Thêm tài khoản Facebook</span>
                </>
              )}
            </button>
          </div>

          {addingSession && pendingKey && (
            <div className="p-3 bg-sky-950/40 border border-sky-500/30 rounded-xl flex items-center justify-between gap-2.5 text-xs text-sky-200">
              <div className="flex items-start gap-2.5">
                <RefreshCw size={15} className="animate-spin text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sky-300">Đang chờ đăng nhập Facebook...</p>
                  <p className="text-[11px] text-sky-300/80 mt-0.5">
                    Vui lòng hoàn tất đăng nhập tài khoản Facebook trên cửa sổ Chrome vừa mở. CRM sẽ tự động nhận biết và kích hoạt tài khoản.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setAddingSession(false); setPendingKey(null); }}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-medium shrink-0 border border-slate-700/60 transition-colors"
              >
                Hủy
              </button>
            </div>
          )}

          {loading ? (
            <div className="py-8 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
              <RefreshCw size={14} className="animate-spin" /> Đang tải danh sách...
            </div>
          ) : accounts.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              Chưa có tài khoản Facebook kết nối. Bấm nút "+ Thêm tài khoản Facebook" để kết nối tài khoản đầu tiên.
            </div>
          ) : (
            <div className="space-y-2.5">
              {accounts.map((acc) => {
                const isCheckpoint = acc.status === 'CHECKPOINT';

                return (
                  <div
                    key={acc.id}
                    className={`p-3.5 rounded-lg border flex items-center justify-between gap-3 ${
                      isCheckpoint
                        ? 'bg-slate-950 border-red-500/40'
                        : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 font-semibold text-xs flex items-center justify-center border border-slate-700/50">
                        {(acc.name || 'F').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-slate-100">{acc.name || 'Tài khoản Facebook'}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-slate-500 font-mono">ID: {acc.id}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                              isCheckpoint
                                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}
                          >
                            {isCheckpoint ? 'Checkpoint / 2FA' : 'Hoạt động'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleStartChrome(acc.id)}
                      disabled={startingId === acc.id}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors border shrink-0 ${
                        isCheckpoint
                          ? 'bg-red-600 hover:bg-red-500 text-white border-red-500'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700/60'
                      }`}
                    >
                      <ExternalLink size={13} />
                      <span>{startingId === acc.id ? 'Đang mở...' : 'Mở Chrome'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/40 text-right">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-xs font-medium transition-colors border border-slate-700/60"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
