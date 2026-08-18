import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

const FIELDS = [
  { value: 'tag', label: 'Nhãn' },
  { value: 'contact', label: 'Thông tin liên hệ' },
  { value: 'activity', label: 'Hoạt động gần nhất' },
  { value: 'reminder', label: 'Nhắc' },
  { value: 'archive', label: 'Lưu trữ' }
];

const OPERATORS = {
  tag: [{ value: 'has', label: 'có nhãn' }, { value: 'not_has', label: 'không có nhãn' }],
  contact: [{ value: 'has', label: 'có' }, { value: 'not_has', label: 'chưa có' }],
  activity: [{ value: 'before', label: 'trước ngày' }, { value: 'after', label: 'từ ngày' }, { value: 'between', label: 'trong khoảng' }],
  reminder: [{ value: 'is', label: 'là' }],
  archive: [{ value: 'is', label: 'là' }]
};

function createRule() {
  return { id: 'rule-' + Date.now() + '-' + Math.random().toString(36).slice(2), field: 'tag', operator: 'has', value: '' };
}

function getDefaultValue(field) {
  if (field === 'contact') return 'phone';
  if (field === 'reminder') return 'due';
  if (field === 'archive') return 'inbox';
  return '';
}

export default function ConversationFilterRuleBuilder({ rules = [], tagOptions = [], onChange }) {
  const replaceRule = (id, patch) => onChange(rules.map((rule) => rule.id === id ? { ...rule, ...patch } : rule));
  const changeField = (rule, field) => replaceRule(rule.id, { field, operator: OPERATORS[field][0].value, value: getDefaultValue(field) });
  const changeValue = (rule, value) => replaceRule(rule.id, { value });

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">Điều kiện tự nhập</h3>
          <p className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">Mỗi điều kiện thêm vào đều phải đúng.</p>
        </div>
        <button type="button" onClick={() => onChange([...rules, createRule()])} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)]">
          <Plus size={13} /> Thêm
        </button>
      </div>
      {rules.length === 0 ? <p className="rounded-lg border border-dashed border-[var(--color-border)] px-2.5 py-2 text-[11px] text-[var(--color-text-muted)]">Chưa có điều kiện tự nhập.</p> : (
        <div className="space-y-2">
          {rules.map((rule, index) => (
            <div key={rule.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-panel)] p-2">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-semibold text-[var(--color-text-muted)]">Điều kiện {index + 1}</span>
                <button type="button" onClick={() => onChange(rules.filter((item) => item.id !== rule.id))} aria-label={'Xóa điều kiện ' + (index + 1)} className="rounded p-0.5 text-[var(--color-text-muted)] hover:bg-red-50 hover:text-red-600"><Trash2 size={13} /></button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <select value={rule.field} onChange={(event) => changeField(rule, event.target.value)} className="min-w-0 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-2 py-1.5 text-[11px] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/25">
                  {FIELDS.map((field) => <option key={field.value} value={field.value}>{field.label}</option>)}
                </select>
                <select value={rule.operator} onChange={(event) => replaceRule(rule.id, { operator: event.target.value })} className="min-w-0 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-2 py-1.5 text-[11px] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/25">
                  {(OPERATORS[rule.field] || []).map((operator) => <option key={operator.value} value={operator.value}>{operator.label}</option>)}
                </select>
              </div>
              <div className="mt-1.5">
                {rule.field === 'tag' && <input list="conversation-filter-tags" value={typeof rule.value === 'string' ? rule.value : ''} onChange={(event) => changeValue(rule, event.target.value)} placeholder="Nhập hoặc chọn nhãn" className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-2 py-1.5 text-[11px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/25" />}
                {rule.field === 'contact' && <select value={rule.value} onChange={(event) => changeValue(rule, event.target.value)} className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-2 py-1.5 text-[11px] text-[var(--color-text-primary)]"><option value="phone">Số điện thoại</option><option value="email">Email</option><option value="address">Địa chỉ</option></select>}
                {rule.field === 'activity' && rule.operator !== 'between' && <input type="date" value={typeof rule.value === 'string' ? rule.value : ''} onChange={(event) => changeValue(rule, event.target.value)} className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-2 py-1.5 text-[11px] text-[var(--color-text-primary)]" />}
                {rule.field === 'activity' && rule.operator === 'between' && <div className="grid grid-cols-2 gap-1.5"><input type="date" value={rule.value?.from || ''} aria-label="Từ ngày" onChange={(event) => changeValue(rule, { ...(rule.value || {}), from: event.target.value })} className="min-w-0 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-2 py-1.5 text-[11px]" /><input type="date" value={rule.value?.to || ''} aria-label="Đến ngày" onChange={(event) => changeValue(rule, { ...(rule.value || {}), to: event.target.value })} className="min-w-0 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-2 py-1.5 text-[11px]" /></div>}
                {rule.field === 'reminder' && <select value={rule.value} onChange={(event) => changeValue(rule, event.target.value)} className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-2 py-1.5 text-[11px]"><option value="due">Đến hạn</option><option value="today">Hôm nay</option><option value="future">Sắp tới</option><option value="none">Không có</option></select>}
                {rule.field === 'archive' && <select value={rule.value} onChange={(event) => changeValue(rule, event.target.value)} className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-2 py-1.5 text-[11px]"><option value="inbox">Inbox</option><option value="archived">Đã lưu trữ</option><option value="all">Tất cả</option></select>}
              </div>
            </div>
          ))}
        </div>
      )}
      <datalist id="conversation-filter-tags">{tagOptions.map((tag) => <option key={tag.value} value={tag.label} />)}</datalist>
    </section>
  );
}
