import React, { useState, useEffect } from 'react';
import { X, Cpu, Key } from 'lucide-react';

export default function AiConfigModal({ accountId = '100088912345678', onClose }) {
  const [provider, setProvider] = useState('LOCAL_OLLAMA');
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState('llama3');
  const [systemPrompt, setSystemPrompt] = useState('Bạn là trợ lý tư vấn bán hàng chuyên nghiệp, thân thiện.');
  const [isActive, setIsActive] = useState(true);
  const [ollamaOnline, setOllamaOnline] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/ollama/health')
      .then(r => r.json())
      .then(d => setOllamaOnline(!!d.online))
      .catch(() => setOllamaOnline(false));

    fetch(`/api/accounts/${accountId}/ai-config`)
      .then(r => r.json())
      .then(data => {
        if (data.provider) setProvider(data.provider);
        if (data.model_name) setModelName(data.model_name);
        if (data.system_prompt) setSystemPrompt(data.system_prompt);
        if (data.is_active !== undefined) setIsActive(!!data.is_active);
      })
      .catch(console.error);
  }, [accountId]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    await fetch(`/api/accounts/${accountId}/ai-config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider,
        api_key: apiKey,
        model_name: modelName,
        system_prompt: systemPrompt,
        is_active: isActive
      })
    });

    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Cpu size={18} className="text-slate-300" />
            <h3 className="text-xs font-semibold text-slate-100 uppercase tracking-wider">Cấu hình Dual-AI Engine</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          <div>
            <label className="text-xs text-slate-400 font-medium mb-1.5 block">AI Provider Engine:</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'LOCAL_OLLAMA', label: 'Local Ollama', badge: ollamaOnline ? '✓ Online' : 'Offline' },
                { id: 'CLOUD_OPENAI', label: 'Cloud OpenAI', badge: 'GPT-4o' },
                { id: 'CLOUD_GEMINI', label: 'Cloud Gemini', badge: '1.5 Flash' }
              ].map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setProvider(p.id);
                    if (p.id === 'LOCAL_OLLAMA') setModelName('llama3');
                    if (p.id === 'CLOUD_OPENAI') setModelName('gpt-4o');
                    if (p.id === 'CLOUD_GEMINI') setModelName('gemini-1.5-flash');
                  }}
                  className={`p-2.5 rounded-md border text-left transition-colors ${
                    provider === p.id
                      ? 'bg-slate-800 border-slate-700 text-slate-100'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900'
                  }`}
                >
                  <div className="text-xs font-semibold">{p.label}</div>
                  <span className="text-[10px] text-slate-500">{p.badge}</span>
                </button>
              ))}
            </div>
          </div>

          {provider !== 'LOCAL_OLLAMA' && (
            <div>
              <label className="text-xs text-slate-400 font-medium mb-1 flex items-center gap-1.5">
                <Key size={12} /> API Key:
              </label>
              <input
                type="password"
                placeholder="Nhập API Key..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full bg-slate-950 text-slate-100 text-xs px-3 py-1.5 rounded-md border border-slate-800 focus:outline-none focus:border-slate-700"
              />
            </div>
          )}

          <div>
            <label className="text-xs text-slate-400 font-medium mb-1 block">Tên Model AI:</label>
            <input
              type="text"
              placeholder="VD: llama3, gpt-4o, gemini-1.5-flash"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              className="w-full bg-slate-950 text-slate-100 text-xs px-3 py-1.5 rounded-md border border-slate-800 focus:outline-none focus:border-slate-700"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 font-medium mb-1 block">System Prompt:</label>
            <textarea
              rows={3}
              placeholder="Kịch bản chỉ dẫn cho AI..."
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="w-full bg-slate-950 text-slate-100 text-xs p-2.5 rounded-md border border-slate-800 focus:outline-none focus:border-slate-700 resize-none"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-950 rounded-md border border-slate-800">
            <div>
              <span className="text-xs font-semibold text-slate-200">Trạng thái AI Chatbot</span>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                isActive
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-slate-900 text-slate-500 border-slate-800'
              }`}
            >
              {isActive ? 'ĐANG BẬT' : 'ĐANG TẮT'}
            </button>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-medium text-xs rounded-md transition-colors"
          >
            {saving ? 'Đang lưu...' : 'Lưu Cấu Hình AI'}
          </button>
        </form>
      </div>
    </div>
  );
}
