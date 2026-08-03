import React, { useState, useEffect, useRef } from 'react';
import {
  Phone,
  Mail,
  Download,
  FileSpreadsheet,
  Activity,
  History,
  Star,
  Bell,
  Archive,
  X,
  UserRound,
  MapPin,
  Link2,
  MessageCircle
} from 'lucide-react';
import EmptyState from './EmptyState.jsx';

const AVATAR_COLORS = ['#2684ff', '#a855f7', '#0fbd74', '#ec4899', '#ff6b2c', '#00b8a9', '#6366f1', '#ff3b4f'];

function pickAvatarColor(value) {
  const text = String(value || 'K');
  const total = [...text].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return AVATAR_COLORS[total % AVATAR_COLORS.length];
}

function normalizeLeadStatus(value) {
  if (['NEW', 'CONTACTED', 'QUALIFIED'].includes(value)) return value;
  if (value === 'COMPLETED') return 'QUALIFIED';
  if (value === 'ASSIGNED') return 'CONTACTED';
  return 'NEW';
}

function statusLabel(value) {
  if (value === 'QUALIFIED') return 'Đã chốt';
  if (value === 'CONTACTED') return 'Đang xử lý';
  return 'Mới';
}

function DetailRow({ icon: Icon, label, value, children }) {
  return (
    <div className="p-3.5 bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)] flex items-center gap-3.5 transition-colors hover:border-[var(--color-border-hover,#334155)] shadow-xs">
      <div className="w-10 h-10 rounded-xl bg-[var(--color-bg-panel)] flex items-center justify-center text-[var(--color-text-muted)] shrink-0 border border-[var(--color-border)]/60">
        <Icon size={18} strokeWidth={1.8} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[var(--color-text-muted)] font-medium leading-none mb-1.5">{label}</p>
        {children || <p className="text-sm font-bold text-[var(--color-text-primary)] truncate leading-snug">{value}</p>}
      </div>
    </div>
  );
}

export default function LeadDetailsPanel({ contactInfo, onSaveContact, onExportLeads, onCloseDrawer }) {
  const [activeTab, setActiveTab] = useState('INFO');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [leadStatus, setLeadStatus] = useState('NEW');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const successTimerRef = useRef(null);

  useEffect(() => {
    if (!contactInfo) return;
    setPhone(contactInfo.phone || '');
    setEmail(contactInfo.email || '');
    setNotes(contactInfo.notes || '');
    setLeadCaptured(Boolean(contactInfo.lead_captured));
    setLeadStatus(normalizeLeadStatus(contactInfo.lead_status || contactInfo.status));
  }, [contactInfo?.thread_id, contactInfo?.phone, contactInfo?.email, contactInfo?.notes, contactInfo?.lead_captured, contactInfo?.status, contactInfo?.lead_status]);

  useEffect(() => () => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
  }, []);

  const savePayload = (override = {}) => ({
    ...contactInfo,
    phone,
    email,
    notes,
    lead_captured: leadCaptured,
    lead_status: leadStatus,
    status: leadStatus,
    ...override
  });

  const handleToggleLead = async () => {
    const updated = !leadCaptured;
    setLeadCaptured(updated);
    await onSaveContact?.(savePayload({ lead_captured: updated }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      await onSaveContact?.(savePayload());
      setSaveSuccess(true);
      successTimerRef.current = setTimeout(() => setSaveSuccess(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  if (!contactInfo) {
    return (
      <div className="w-[var(--lead-panel-width)] bg-[var(--color-bg-panel)] border-l border-[var(--color-border)] flex flex-col h-full shrink-0 select-none">
        <div className="h-[var(--header-height)] border-b border-[var(--color-border)] px-4 flex items-center justify-between shrink-0">
          <h3 className="font-bold text-[var(--color-text-primary)] text-base">Thông tin khách hàng</h3>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <EmptyState icon={UserRound} title="Chưa chọn hội thoại" description="Chọn một hội thoại để xem thông tin khách hàng." />
        </div>
        <ExportFooter onExportLeads={onExportLeads} />
      </div>
    );
  }

  const name = contactInfo.name || contactInfo.contact_name || 'Khách hàng';
  const nameInitial = name.charAt(0).toUpperCase();
  const avatarColor = pickAvatarColor(contactInfo.thread_id || name);
  const accountText = contactInfo.account_name || contactInfo.account_id || 'FB Account';
  const notePreview = notes || 'Khách quan tâm sản phẩm. Cần ghi chú nhu cầu, báo giá và lịch chăm sóc.';

  const quickActions = [
    { icon: Phone, label: 'Gọi', className: 'text-[var(--color-success)] bg-[var(--color-success-subtle)]' },
    { icon: Star, label: 'VIP', className: 'text-[var(--color-warning)] bg-[var(--color-warning-subtle)]' },
    { icon: Bell, label: 'Nhắc', className: 'text-[var(--color-accent)] bg-[var(--color-accent-subtle)]' },
    { icon: Archive, label: 'Lưu', className: 'text-[var(--color-text-secondary)] bg-[var(--color-bg-surface)]' }
  ];

  return (
    <div className="w-[var(--lead-panel-width)] bg-[var(--color-bg-panel)] border-l border-[var(--color-border)] flex flex-col h-full shrink-0 select-none">
      <div className="px-4 pt-4 pb-3 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-[var(--color-text-primary)] text-base">Thông tin khách hàng</h3>
          {onCloseDrawer && (
            <button onClick={onCloseDrawer} title="Đóng" aria-label="Đóng" className="w-8 h-8 inline-flex items-center justify-center hover:bg-[var(--color-bg-hover)] rounded-full transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
              <X size={17} strokeWidth={1.75} />
            </button>
          )}
        </div>

        <div className="flex flex-col items-center text-center">
          {contactInfo.avatar_url ? (
            <img src={String(contactInfo.avatar_url).startsWith('http') ? contactInfo.avatar_url : `/api/avatars/${contactInfo.avatar_url}`} alt="" className="w-16 h-16 rounded-full object-cover border border-[var(--color-border)] shadow-md mb-2.5" />
          ) : (
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-[var(--color-text-on-accent)] text-2xl font-bold shadow-md mb-2.5" style={{ backgroundColor: avatarColor }}>
              {nameInitial}
            </div>
          )}
          <h4 className="font-bold text-[var(--color-text-primary)] text-lg leading-tight text-center max-w-full truncate">{name}</h4>
          <button
            type="button"
            onClick={handleToggleLead}
            className="flex items-center gap-1.5 mt-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-success)] transition-colors"
            title="Đổi trạng thái thu thập liên hệ"
          >
            <span className={`w-2.5 h-2.5 rounded-full ${leadCaptured ? 'bg-[var(--color-success)]' : 'bg-[var(--color-text-muted)]'}`} />
            <span className="font-medium">{leadCaptured ? 'Đã bóc tách liên hệ' : 'Chưa có liên hệ'}</span>
          </button>
          <span className="mt-2 text-xs px-3.5 py-1 rounded-full font-semibold bg-[var(--color-warning-subtle)] text-[var(--color-warning)]">
            {statusLabel(leadStatus)}
          </span>
        </div>
      </div>

      <div className="px-4 pb-3 border-b border-[var(--color-border)] shrink-0">
        <div className="grid grid-cols-4 gap-2">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button key={action.label} type="button" className={`h-11 flex flex-col items-center justify-center gap-1 rounded-xl hover:opacity-80 transition-opacity ${action.className}`}>
                <Icon size={16} strokeWidth={1.8} />
                <span className="text-xs font-semibold">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 bg-[var(--color-bg-surface)] p-1 mx-4 mt-3 rounded-xl shrink-0">
        {[
          { id: 'INFO', label: 'Thông tin' },
          { id: 'NOTES', label: 'Ghi chú' },
          { id: 'HISTORY', label: 'Lịch sử' }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`h-8 text-xs font-bold rounded-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-[var(--color-bg-panel)] text-[var(--color-text-primary)] shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-4 py-4 space-y-6">
          {activeTab === 'INFO' && (
            <>
              <div className="space-y-2.5">
                <SectionTitle>Chi tiết</SectionTitle>
                <div className="space-y-2.5">
                  <DetailRow icon={MessageCircle} label="Nguồn" value="Facebook Messenger" />
                  <DetailRow icon={Link2} label="Tài khoản" value={accountText} />
                  <DetailRow icon={Activity} label="Trạng thái">
                    <select
                      value={leadStatus}
                      onChange={(event) => setLeadStatus(event.target.value)}
                      className="w-full bg-[var(--color-bg-panel)] text-[var(--color-text-primary)] text-sm font-bold focus:outline-none cursor-pointer rounded-lg px-2.5 py-1 border border-[var(--color-border)]/60 transition-colors"
                    >
                      <option value="NEW" className="bg-[var(--color-bg-panel)] text-[var(--color-text-primary)]">Mới</option>
                      <option value="CONTACTED" className="bg-[var(--color-bg-panel)] text-[var(--color-text-primary)]">Đang xử lý</option>
                      <option value="QUALIFIED" className="bg-[var(--color-bg-panel)] text-[var(--color-text-primary)]">Đã chốt đơn</option>
                    </select>
                  </DetailRow>
                  <DetailRow icon={Phone} label="Số điện thoại">
                    <input
                      type="text"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="Chưa có"
                      className="w-full bg-transparent text-[var(--color-text-primary)] text-sm font-bold focus:outline-none placeholder:text-[var(--color-text-muted)] font-mono"
                    />
                  </DetailRow>
                  <DetailRow icon={Mail} label="Email">
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="Chưa có"
                      className="w-full bg-transparent text-[var(--color-text-primary)] text-sm font-bold focus:outline-none placeholder:text-[var(--color-text-muted)] font-mono"
                    />
                  </DetailRow>
                  <DetailRow icon={MapPin} label="Địa chỉ" value="Chưa có" />
                </div>
              </div>

              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between">
                  <SectionTitle>Tags</SectionTitle>
                  <button type="button" className="text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] font-medium">+ Thêm</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs bg-[var(--color-accent-subtle)] text-[var(--color-accent)] px-2.5 py-1 rounded-full font-medium border border-[var(--color-accent)]/20">Tiềm năng</span>
                  <span className="text-xs bg-[var(--color-success-subtle)] text-[var(--color-success)] px-2.5 py-1 rounded-full font-medium border border-[var(--color-success)]/20">Quan tâm</span>
                  {!leadCaptured && <span className="text-xs bg-[var(--color-warning-subtle)] text-[var(--color-warning)] px-2.5 py-1 rounded-full font-medium border border-[var(--color-warning)]/20">Cần tư vấn</span>}
                </div>
              </div>

              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between">
                  <SectionTitle>Ghi chú</SectionTitle>
                  <button type="button" onClick={() => setActiveTab('NOTES')} className="text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] font-medium">+ Thêm</button>
                </div>
                <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl p-3.5 shadow-sm space-y-1.5">
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{notePreview}</p>
                  <span className="inline-block text-[11px] text-[var(--color-warning)] font-medium">Gần đây</span>
                </div>
              </div>
            </>
          )}

          {activeTab === 'NOTES' && (
            <div className="space-y-2.5">
              <SectionTitle>Ghi chú chăm sóc</SectionTitle>
              <textarea
                rows={8}
                placeholder="Nhu cầu, sản phẩm quan tâm, báo giá, lịch hẹn chăm sóc..."
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="w-full bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] text-xs p-3.5 rounded-xl border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] resize-none placeholder:text-[var(--color-text-muted)] leading-relaxed min-h-[180px]"
              />
            </div>
          )}

          {activeTab === 'HISTORY' && (
            <div className="space-y-3 text-xs">
              <SectionTitle>Lịch sử tương tác</SectionTitle>
              <div className="p-3.5 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl space-y-2.5">
                <HistoryLine label="Thread ID" value={contactInfo.thread_id} mono />
                <HistoryLine label="Nguồn" value="Facebook Messenger" />
                <HistoryLine label="Bóc tách liên hệ" value={leadCaptured ? 'Thành công' : 'Chưa có'} success={leadCaptured} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-panel)] shrink-0 p-3.5 space-y-2.5">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className={`w-full h-9.5 rounded-xl text-xs font-semibold transition-colors ${
            saveSuccess
              ? 'bg-[var(--color-success-subtle)] text-[var(--color-success)] border border-[var(--color-success)]/30'
              : 'bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-40 text-[var(--color-text-on-accent)] shadow-sm'
          }`}
        >
          {saving ? 'Đang lưu...' : saveSuccess ? 'Đã cập nhật' : 'Lưu thông tin'}
        </button>
        <ExportFooter onExportLeads={onExportLeads} />
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return <h5 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{children}</h5>;
}

function HistoryLine({ label, value, mono = false, success = false }) {
  return (
    <div className="flex justify-between gap-3 text-[var(--color-text-muted)]">
      <span>{label}</span>
      <span className={`${mono ? 'font-mono' : ''} ${success ? 'text-[var(--color-success)] font-medium' : 'text-[var(--color-text-secondary)]'} truncate`}>{value}</span>
    </div>
  );
}

function ExportFooter({ onExportLeads }) {
  const btnClass = 'flex-1 h-8 flex items-center justify-center gap-1.5 bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-hover)] text-xs font-medium rounded-xl transition-colors border border-[var(--color-border)]';
  return (
    <div className="flex gap-2">
      <button type="button" onClick={() => onExportLeads?.('excel')} className={`${btnClass} text-[var(--color-success)]`}>
        <FileSpreadsheet size={13} strokeWidth={1.75} /> Excel
      </button>
      <button type="button" onClick={() => onExportLeads?.('csv')} className={`${btnClass} text-[var(--color-text-secondary)]`}>
        <Download size={13} strokeWidth={1.75} /> CSV
      </button>
    </div>
  );
}
