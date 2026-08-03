import React, { useState, useEffect } from 'react';
import { Phone, Mail, FileText, CheckCircle2, Download, FileSpreadsheet } from 'lucide-react';

export default function LeadPanel({ contactInfo, onSaveContact, onExportLeads }) {
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (contactInfo) {
      setPhone(contactInfo.phone || '');
      setEmail(contactInfo.email || '');
      setNotes(contactInfo.notes || '');
      setLeadCaptured(!!contactInfo.lead_captured);
    }
  }, [contactInfo?.thread_id]);

  if (!contactInfo) {
    return (
      <div className="w-[340px] bg-slate-900 border-l border-slate-800 flex flex-col h-full shrink-0 select-none">
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs p-6 text-center">
          <CheckCircle2 size={32} className="mb-2 opacity-20" />
          Chọn hội thoại để xem thông tin Lead
        </div>
        <div className="p-4 border-t border-slate-800 space-y-2">
          <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-2">Xuất danh sách Lead</p>
          <button
            onClick={() => onExportLeads('excel')}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700/60 rounded-md text-xs font-medium transition-colors"
          >
            <FileSpreadsheet size={14} />
            <span>Xuất Excel (.xlsx)</span>
          </button>
          <button
            onClick={() => onExportLeads('csv')}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 rounded-md text-xs font-medium transition-colors"
          >
            <Download size={14} />
            <span>Xuất CSV (.csv)</span>
          </button>
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    await onSaveContact({ ...contactInfo, phone, email, notes, lead_captured: leadCaptured });
    setSaving(false);
  };

  const handleToggleLead = async () => {
    const updated = !leadCaptured;
    setLeadCaptured(updated);
    await onSaveContact({ ...contactInfo, phone, email, notes, lead_captured: updated });
  };

  return (
    <div className="w-[340px] bg-slate-900 border-l border-slate-800 flex flex-col h-full shrink-0 select-none">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Profile Header */}
        <div className="flex flex-col items-center text-center pt-2">
          <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-200 font-semibold text-base flex items-center justify-center border border-slate-700/60 mb-2">
            {(contactInfo.name || 'K').charAt(0).toUpperCase()}
          </div>
          <h3 className="text-xs font-semibold text-slate-100">{contactInfo.name || 'Khách hàng FB'}</h3>

          {/* Lead Captured Toggle */}
          <button
            onClick={handleToggleLead}
            className={`mt-2.5 w-full py-1.5 px-3 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors border ${
              leadCaptured
                ? 'bg-emerald-600/10 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-700/60'
            }`}
          >
            <CheckCircle2 size={13} />
            {leadCaptured ? '✓ ĐÃ THU THẬP LEAD' : 'ĐÁNH DẤU LẤY LIÊN HỆ'}
          </button>
        </div>

        <hr className="border-slate-800" />

        {/* Contact Fields */}
        <div className="space-y-2.5">
          <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Thông tin liên hệ</h4>

          <div>
            <label className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
              <Phone size={12} className="text-blue-400" /> Số điện thoại
            </label>
            <input
              type="text"
              placeholder="Chưa có SĐT..."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-slate-950 text-slate-100 text-xs px-3 py-1.5 rounded-md border border-slate-800 focus:outline-none focus:border-slate-700"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
              <Mail size={12} className="text-blue-400" /> Email
            </label>
            <input
              type="email"
              placeholder="Chưa có Email..."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950 text-slate-100 text-xs px-3 py-1.5 rounded-md border border-slate-800 focus:outline-none focus:border-slate-700"
            />
          </div>
        </div>

        <hr className="border-slate-800" />

        {/* Notes */}
        <div className="space-y-2">
          <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <FileText size={12} /> Ghi chú
          </h4>
          <textarea
            rows={3}
            placeholder="Ghi chú yêu cầu..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-slate-950 text-slate-100 text-xs p-2.5 rounded-md border border-slate-800 focus:outline-none focus:border-slate-700 resize-none"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium rounded-md transition-colors"
          >
            {saving ? 'Đang lưu...' : 'Lưu thông tin'}
          </button>
        </div>
      </div>

      {/* Export Leads */}
      <div className="p-4 border-t border-slate-800 space-y-2 shrink-0">
        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Xuất danh sách Lead</p>
        <button
          onClick={() => onExportLeads('excel')}
          className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700/60 rounded-md text-xs font-medium transition-colors"
        >
          <FileSpreadsheet size={13} />
          <span>Xuất Excel (.xlsx)</span>
        </button>
        <button
          onClick={() => onExportLeads('csv')}
          className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 rounded-md text-xs font-medium transition-colors"
        >
          <Download size={13} />
          <span>Xuất CSV (.csv)</span>
        </button>
      </div>
    </div>
  );
}
