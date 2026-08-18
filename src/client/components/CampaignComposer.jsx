import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Eye,
  FileText,
  FolderUp,
  Gauge,
  ImagePlus,
  MessageSquare,
  Paperclip,
  Plus,
  Phone,
  Repeat,
  Save,
  Send,
  Settings2,
  Timer,
  Trash2,
  Zap
} from 'lucide-react';

const fieldClass = 'h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 outline-none transition-colors focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60';

export default function CampaignComposer({ campaign, config, onChanged, leadStatuses = [] }) {
  const [messages, setMessages] = useState([]);
  const [startPosition, setStartPosition] = useState(1);
  const [direction, setDirection] = useState('asc');
  const [pacingMs, setPacingMs] = useState(5000);
  const [maxRetries, setMaxRetries] = useState(0);
  const [sendCap, setSendCap] = useState(1);
  const [phoneCapturePolicy, setPhoneCapturePolicy] = useState('continue');
  const [phoneCaptureThankYouText, setPhoneCaptureThankYouText] = useState('Cảm ơn bạn, bên mình đã nhận được số điện thoại.');
  const [phoneCaptureStatusId, setPhoneCaptureStatusId] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const editable = ['draft', 'ready'].includes(campaign?.status);

  useEffect(() => {
    setMessages((campaign?.messages || []).map((message) => ({ ...message })));
    setStartPosition(campaign?.start_position || 1);
    setDirection(campaign?.direction || 'asc');
    setPacingMs(campaign?.pacing_ms || 5000);
    setMaxRetries(campaign?.max_retries || 0);
    setSendCap(campaign?.send_cap || 1);
    setPhoneCapturePolicy(campaign?.phone_capture_policy || 'continue');
    setPhoneCaptureThankYouText(campaign?.phone_capture_thank_you_text || 'Cảm ơn bạn, bên mình đã nhận được số điện thoại.');
    setPhoneCaptureStatusId(campaign?.phone_capture_status_id == null ? '' : String(campaign.phone_capture_status_id));
  }, [campaign]);

  const updateMessage = (index, value) => {
    setMessages((current) => current.map((message, messageIndex) => (
      messageIndex === index ? { ...message, text_content: value } : message
    )));
  };

  const save = async () => {
    setBusy('save');
    setError('');
    try {
      const response = await fetch('/api/campaigns/' + campaign.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map((message) => ({ text_content: message.text_content })),
          start_position: Number(startPosition),
          direction,
          pacing_ms: Number(pacingMs),
          max_retries: Number(maxRetries),
          send_cap: Number(sendCap),
          phone_capture_policy: phoneCapturePolicy,
          phone_capture_thank_you_text: phoneCapturePolicy === 'thank_then_stop' ? phoneCaptureThankYouText.trim() : null,
          phone_capture_status_id: phoneCapturePolicy === 'continue' || !phoneCaptureStatusId ? null : Number(phoneCaptureStatusId)
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || 'Không lưu được campaign.');
      onChanged(payload);
      return payload;
    } catch (requestError) {
      setError(requestError.message);
      return null;
    } finally {
      setBusy('');
    }
  };

  const preview = async () => {
    const saved = await save();
    if (!saved) return;
    setBusy('preview');
    try {
      const response = await fetch('/api/campaigns/' + campaign.id + '/preview', { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || 'Preview không hợp lệ.');
      onChanged(payload);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy('');
    }
  };

  const uploadAttachment = async (message, file) => {
    if (!file || !message.id) return;
    setBusy('attachment-' + message.id);
    setError('');
    const form = new FormData();
    form.append('campaign_message_id', message.id);
    form.append('file', file);
    try {
      const response = await fetch('/api/campaigns/' + campaign.id + '/attachments', {
        method: 'POST',
        body: form
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || 'Không tải được ảnh.');
      onChanged(payload.campaign);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy('');
    }
  };

  // Spec 040: several independently-picked files travel in one request and
  // are grouped server-side into one manifest (CampaignAttachmentService.saveUploads).
  const uploadFiles = async (message, fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length || !message.id) return;
    setBusy('attachment-' + message.id);
    setError('');
    const form = new FormData();
    form.append('campaign_message_id', message.id);
    files.forEach((file) => form.append('files', file, file.name));
    try {
      const response = await fetch('/api/campaigns/' + campaign.id + '/attachments', {
        method: 'POST',
        body: form
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || 'Không tải được file.');
      onChanged(payload.campaign);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy('');
    }
  };

  // Spec 040 FR-002: a folder selection is packaged server-side into one ZIP.
  // Each File from a webkitdirectory input carries its relative path in
  // webkitRelativePath (e.g. "my-folder/sub/photo.jpg") - passing that as the
  // FormData filename (3rd arg) is what lets the server reconstruct it,
  // since a bare filename would lose the folder structure.
  const uploadFolder = async (message, fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length || !message.id) return;
    setBusy('attachment-' + message.id);
    setError('');
    const folderName = (files[0].webkitRelativePath || files[0].name).split('/')[0] || 'folder';
    const form = new FormData();
    form.append('campaign_message_id', message.id);
    form.append('kind', 'folder_zip');
    form.append('archive_name', folderName + '.zip');
    files.forEach((file) => form.append('files', file, file.webkitRelativePath || file.name));
    try {
      const response = await fetch('/api/campaigns/' + campaign.id + '/attachments', {
        method: 'POST',
        body: form
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || 'Không tải được thư mục.');
      onChanged(payload.campaign);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy('');
    }
  };

  const removeAttachment = async (attachmentId) => {
    setBusy('attachment-' + attachmentId);
    setError('');
    try {
      const response = await fetch('/api/campaigns/' + campaign.id + '/attachments/' + attachmentId, { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || 'Không xóa được ảnh.');
      onChanged(payload.campaign);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy('');
    }
  };

  const settings = [
    {
      label: 'Bắt đầu',
      icon: Zap,
      control: editable
        ? <input aria-label="Vị trí bắt đầu" type="number" min="1" max={campaign.recipients.length} value={startPosition} onChange={(event) => setStartPosition(event.target.value)} className={fieldClass} />
        : <span>{startPosition}</span>
    },
    {
      label: 'Chiều',
      icon: Gauge,
      control: editable
        ? (
          <select aria-label="Chiều gửi" value={direction} onChange={(event) => setDirection(event.target.value)} className={fieldClass}>
            <option value="asc">Tăng dần</option>
            <option value="desc">Giảm dần</option>
          </select>
        )
        : <span>{direction === 'desc' ? 'Giảm dần' : 'Tăng dần'}</span>
    },
    {
      label: 'Pacing (ms)',
      icon: Timer,
      control: editable
        ? <input aria-label="Pacing mili giây" type="number" min={config?.minimumPacingMs || 0} step="500" value={pacingMs} onChange={(event) => setPacingMs(event.target.value)} className={fieldClass} />
        : <span>{Number(pacingMs).toLocaleString('vi-VN')}</span>
    },
    {
      label: 'Retry',
      icon: Repeat,
      control: editable
        ? <input aria-label="Số lần retry" type="number" min="0" max="3" value={maxRetries} onChange={(event) => setMaxRetries(event.target.value)} className={fieldClass} />
        : <span>{maxRetries}</span>
    },
    {
      label: 'Send cap',
      icon: Send,
      control: editable
        ? <input aria-label="Giới hạn gửi" type="number" min="1" max={config?.maxRecipients || campaign.recipients.length} value={sendCap} onChange={(event) => setSendCap(event.target.value)} className={fieldClass} />
        : <span>{sendCap}</span>
    }
  ];

  return (
    <section className="grid gap-4 lg:grid-cols-5" aria-labelledby="campaign-composer-title">
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm lg:col-span-3">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h3 id="campaign-composer-title" className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <MessageSquare className="h-4 w-4 text-blue-500" />
            Nội dung & thứ tự gửi
          </h3>
          <div className="flex items-center gap-2">
            {editable && messages.length < 5 && (
              <button type="button" onClick={() => setMessages((current) => [...current, { text_content: '', attachments: [] }])} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200">
                <Plus size={14} /> Thêm message
              </button>
            )}
          </div>
        </div>
        <p className="mb-3 text-xs text-slate-400">Mỗi người nhận sẽ nhận lần lượt các tin nhắn bên dưới.</p>

        {error && <div role="alert" className="mb-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>}

        <div className="space-y-3">
          {messages.map((message, index) => {
            const invalid = message.validation_status === 'invalid';
            return (
              <div key={message.id || 'new-' + index} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-600">Message {index + 1}</span>
                  <span className={'inline-flex items-center gap-1 text-[11px] font-medium ' + (invalid ? 'text-red-500' : 'text-emerald-500')}>
                    {!invalid && <CheckCircle2 size={12} />}
                    {invalid ? message.validation_error : (message.validation_status === 'valid' ? 'Hợp lệ' : 'Chưa lưu')}
                  </span>
                </div>

                {editable ? (
                  <textarea value={message.text_content || ''} onChange={(event) => updateMessage(index, event.target.value)} rows="4" className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm leading-relaxed text-slate-700 outline-none transition-shadow placeholder:text-slate-300 focus:ring-2 focus:ring-blue-100" placeholder="Nhập caption hoặc nội dung tin nhắn..." />
                ) : (
                  <p className="min-h-12 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{message.text_content || '—'}</p>
                )}

                {((message.attachments || []).length > 0 || editable) && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {(message.manifests || []).map((manifest) => (
                      <span key={manifest.id} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-600">
                        {manifest.kind === 'folder_zip' ? <FolderUp size={13} /> : <Paperclip size={13} />}
                        {manifest.kind === 'folder_zip'
                          ? (manifest.archive_name || 'folder.zip') + ' · ' + manifest.item_count + ' file'
                          : manifest.item_count + ' file đính kèm'}
                      </span>
                    ))}
                    {(message.attachments || []).map((attachment) => (
                      <span key={attachment.id} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600">
                        {attachment.media_type === 'image' ? <ImagePlus size={13} className="text-blue-500" /> : <FileText size={13} className="text-slate-500" />}
                        <span className="max-w-44 truncate">{attachment.original_name}</span>
                        {editable && (
                          <button type="button" onClick={() => removeAttachment(attachment.id)} disabled={busy === 'attachment-' + attachment.id} aria-label={'Xóa ' + attachment.original_name} className="rounded text-slate-400 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </span>
                    ))}
                    {editable && (
                      <label className={'inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-2.5 text-xs font-semibold text-slate-500 ' + (!config?.imageEnabled || !message.id ? 'cursor-not-allowed opacity-45' : 'cursor-pointer hover:bg-white')}>
                        <ImagePlus size={14} /> Thêm ảnh
                        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={!config?.imageEnabled || !message.id || busy.startsWith('attachment-')} onChange={(event) => uploadAttachment(message, event.target.files?.[0])} />
                      </label>
                    )}
                    {editable && config?.fileEnabled && (
                      <label className={'inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-2.5 text-xs font-semibold text-slate-500 ' + (!message.id ? 'cursor-not-allowed opacity-45' : 'cursor-pointer hover:bg-white')}>
                        <Paperclip size={14} /> Thêm file
                        <input type="file" multiple className="sr-only" disabled={!message.id || busy.startsWith('attachment-')} onChange={(event) => uploadFiles(message, event.target.files)} />
                      </label>
                    )}
                    {editable && config?.fileEnabled && (
                      <label className={'inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-2.5 text-xs font-semibold text-slate-500 ' + (!message.id ? 'cursor-not-allowed opacity-45' : 'cursor-pointer hover:bg-white')}>
                        <FolderUp size={14} /> Thêm thư mục
                        <input type="file" webkitdirectory="" directory="" className="sr-only" disabled={!message.id || busy.startsWith('attachment-')} onChange={(event) => uploadFolder(message, event.target.files)} />
                      </label>
                    )}
                    {!config?.imageEnabled && !config?.fileEnabled && <span className="text-[11px] italic text-slate-400">Attachment transport đang tắt</span>}
                    {!message.id && editable && <span className="text-[11px] text-slate-400">Lưu draft trước khi đính kèm.</span>}
                  </div>
                )}
              </div>
            );
          })}
          {messages.length === 0 && <p className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400">Chưa có nội dung tin nhắn.</p>}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm lg:col-span-2">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700">
          <Settings2 className="h-4 w-4 text-indigo-500" />
          Cấu hình gửi
        </h3>

        <div className="space-y-2">
          {settings.map((setting) => {
            const Icon = setting.icon;
            return (
              <div key={setting.label} className={editable ? 'grid grid-cols-[1fr_7.5rem] items-center gap-3 py-1' : 'flex items-center justify-between py-1.5'}>
                <span className="flex items-center gap-2 text-xs text-slate-400">
                  <Icon className="h-3.5 w-3.5" />
                  {setting.label}
                </span>
                {editable ? setting.control : <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{setting.control}</span>}
              </div>
            );
          })}
        </div>

        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-600"><Phone size={14} className="text-emerald-500" /> Khi khách gửi số điện thoại</p>
          {editable ? (
            <div className="space-y-2">
              <select aria-label="Hành động khi khách gửi số điện thoại" value={phoneCapturePolicy} onChange={(event) => setPhoneCapturePolicy(event.target.value)} className={fieldClass}>
                <option value="continue">Chỉ lưu số, tiếp tục chiến dịch</option>
                <option value="stop_remaining">Lưu số và dừng các tin chưa gửi</option>
                <option value="thank_then_stop">Gửi lời cảm ơn rồi dừng các tin chưa gửi</option>
              </select>
              {phoneCapturePolicy !== 'continue' && <select aria-label="Đổi trạng thái khi nhận số" value={phoneCaptureStatusId} onChange={(event) => setPhoneCaptureStatusId(event.target.value)} className={fieldClass}><option value="">Không đổi trạng thái</option>{leadStatuses.map((status) => <option key={status.id} value={status.id}>{status.name}</option>)}</select>}
              {phoneCapturePolicy === 'thank_then_stop' && <textarea aria-label="Tin nhắn cảm ơn" value={phoneCaptureThankYouText} onChange={(event) => setPhoneCaptureThankYouText(event.target.value)} rows="3" className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100" />}
            </div>
          ) : <p className="text-xs leading-relaxed text-slate-500">{phoneCapturePolicy === 'continue' ? 'Chỉ lưu số, tiếp tục chiến dịch.' : phoneCapturePolicy === 'stop_remaining' ? 'Lưu số và dừng các tin chưa gửi.' : 'Gửi lời cảm ơn rồi dừng các tin chưa gửi.'}</p>}
        </div>

        {editable && (
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <button type="button" onClick={save} disabled={!!busy} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-45">
              <Save size={14} /> {busy === 'save' ? 'Đang lưu' : 'Lưu draft'}
            </button>
            <button type="button" onClick={preview} disabled={!!busy} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-45">
              {direction === 'desc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
              <Eye size={14} /> {busy === 'preview' ? 'Đang preview' : 'Preview'}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
