import React, { useState, useEffect } from 'react';
import { X, Zap, Plus, Trash2 } from 'lucide-react';

export default function AutoReplyModal({ accountId = '100088912345678', onClose }) {
  const [rules, setRules] = useState([]);
  const [triggerKeyword, setTriggerKeyword] = useState('');
  const [responseTemplate, setResponseTemplate] = useState('');
  const [loading, setLoading] = useState(true);

  const loadRules = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/accounts/${accountId}/auto-replies`);
      const data = await res.json();
      setRules(data);
    } catch {
      setRules([
        { id: 1, trigger_keyword: 'báo giá', response_template: 'Chào {ten_khach_hang}, shop đã gửi bảng giá vào inbox ạ!', is_active: 1 }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRules(); }, [accountId]);

  const handleAddRule = async (e) => {
    e.preventDefault();
    if (!triggerKeyword.trim() || !responseTemplate.trim()) return;

    await fetch(`/api/accounts/${accountId}/auto-replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger_keyword: triggerKeyword, response_template: responseTemplate })
    });

    setTriggerKeyword('');
    setResponseTemplate('');
    loadRules();
  };

  const handleToggle = async (id, currentStatus) => {
    await fetch(`/api/auto-replies/${id}/toggle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !currentStatus })
    });
    setRules(prev => prev.map(r => r.id === id ? { ...r, is_active: !currentStatus ? 1 : 0 } : r));
  };

  const handleDelete = async (id) => {
    await fetch(`/api/auto-replies/${id}`, { method: 'DELETE' });
    setRules(prev => prev.filter(r => r.id !== id));
  };

  const insertVariable = (varName) => {
    setResponseTemplate(prev => prev + varName);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-slate-300" />
            <h3 className="text-xs font-semibold text-slate-100 uppercase tracking-wider">Quản lý Phản hồi Tự động (Auto-Reply)</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Form thêm quy tắc */}
          <form onSubmit={handleAddRule} className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 space-y-3">
            <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Thêm quy tắc mới</h4>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">Từ khóa kích hoạt (Trigger keyword):</label>
              <input
                type="text"
                placeholder="VD: báo giá, địa chỉ, tư vấn..."
                value={triggerKeyword}
                onChange={(e) => setTriggerKeyword(e.target.value)}
                className="w-full bg-slate-900 text-slate-100 text-xs px-3 py-1.5 rounded-md border border-slate-800 focus:outline-none focus:border-slate-700"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-slate-400">Nội dung mẫu phản hồi:</label>
                <button
                  type="button"
                  onClick={() => insertVariable('{ten_khach_hang}')}
                  className="text-[11px] text-blue-400 hover:underline font-medium"
                >
                  + Chèn {'{ten_khach_hang}'}
                </button>
              </div>
              <textarea
                rows={2}
                placeholder="VD: Dạ chào {ten_khach_hang}, shop xin báo giá chi tiết..."
                value={responseTemplate}
                onChange={(e) => setResponseTemplate(e.target.value)}
                className="w-full bg-slate-900 text-slate-100 text-xs p-2.5 rounded-md border border-slate-800 focus:outline-none focus:border-slate-700 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={!triggerKeyword.trim() || !responseTemplate.trim()}
              className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-medium text-xs rounded-md transition-colors border border-slate-700/60 flex items-center justify-center gap-1.5"
            >
              <Plus size={14} /> Thêm Quy Tắc
            </button>
          </form>

          {/* Danh sách quy tắc */}
          <div className="space-y-2.5">
            <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Danh sách quy tắc ({rules.length})</h4>

            {rules.map((rule) => (
              <div key={rule.id} className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-mono font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded inline-block mb-1">
                    "{rule.trigger_keyword}"
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed">{rule.response_template}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggle(rule.id, rule.is_active)}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                      rule.is_active
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-slate-900 text-slate-500 border-slate-800'
                    }`}
                  >
                    {rule.is_active ? 'Đang bật' : 'Tắt'}
                  </button>
                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
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
