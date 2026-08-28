import React, { useState } from 'react';
import {
  BarChart3, Eye, EyeOff, LockKeyhole, LogIn, MessageCircle,
  ShieldCheck, UserPlus, Users
} from 'lucide-react';

export default function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (mode === 'register' && password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.message || 'Không thể xác thực tài khoản.');
      onAuthenticated(result.user);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
    setPassword('');
    setConfirmPassword('');
  };

  const inputClass = 'w-full h-12 rounded-lg border border-slate-400 bg-white px-4 text-base font-normal text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15';

  return (
    <main className="min-h-screen bg-white flex">
      <section className="w-full min-h-screen overflow-hidden bg-white grid lg:grid-cols-[0.9fr_1.1fr]">
        <div className="flex flex-col px-7 py-8 sm:px-14 lg:px-[8vw] lg:py-12">
          <div className="flex items-center gap-2.5 text-slate-950">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/20">
              <MessageCircle size={20} fill="currentColor" />
            </div>
            <div>
              <div className="font-bold tracking-tight leading-none">MISSPRICE</div>
              <div className="text-[10px] tracking-[0.24em] text-slate-500 mt-1">CRM</div>
            </div>
          </div>

          <div className="flex-1 flex items-center py-12">
            <div className="w-full max-w-sm mx-auto">
              <div className="mb-8">
                <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-700 mb-3">
                  {mode === 'login' ? 'Chào mừng trở lại' : 'Tạo tài khoản mới'}
                </p>
                <h1 className="text-4xl font-bold tracking-tight text-slate-950">
                  {mode === 'login' ? 'Đăng nhập tài khoản' : 'Đăng ký tài khoản'}
                </h1>
                <p className="mt-3 text-base leading-7 font-normal text-slate-600">
                  {mode === 'login'
                    ? 'Nhập thông tin của bạn để tiếp tục vào hệ thống CRM.'
                    : 'Tạo tài khoản nhân viên để bắt đầu sử dụng hệ thống.'}
                </p>
              </div>

              <div className="mb-6 grid grid-cols-2 border-b border-slate-200" role="tablist" aria-label="Chọn hình thức xác thực">
                <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => switchMode('login')} className={`pb-3 text-base font-medium border-b-2 transition ${mode === 'login' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Đăng nhập</button>
                <button type="button" role="tab" aria-selected={mode === 'register'} onClick={() => switchMode('register')} className={`pb-3 text-base font-medium border-b-2 transition ${mode === 'register' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Đăng ký</button>
              </div>

              <form onSubmit={submit} className="space-y-4">
                {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>}
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">Tên đăng nhập</span>
                  <input autoFocus autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} maxLength={32} required className={inputClass} placeholder="Nhập tên đăng nhập" />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">Mật khẩu</span>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength={mode === 'register' ? 8 : undefined} required className={`${inputClass} pr-11`} placeholder={mode === 'register' ? 'Tối thiểu 8 ký tự' : 'Nhập mật khẩu'} />
                    <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-800">{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button>
                  </div>
                </label>
                {mode === 'register' && (
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">Xác nhận mật khẩu</span>
                    <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} required className={inputClass} placeholder="Nhập lại mật khẩu" />
                  </label>
                )}
                <button disabled={loading} className="w-full h-12 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 text-white text-base font-semibold shadow-lg shadow-blue-600/20 transition flex items-center justify-center gap-2">
                  {mode === 'login' ? <LogIn size={17} /> : <UserPlus size={17} />}
                  {loading ? 'Đang xử lý...' : mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
                </button>
              </form>
            </div>
          </div>

          <p className="text-center text-sm font-medium text-slate-500">Đăng nhập an toàn · Dữ liệu được lưu trên máy của bạn</p>
        </div>

        <aside className="relative hidden lg:flex overflow-hidden bg-gradient-to-br from-blue-800 via-blue-600 to-sky-400 text-white p-14 flex-col" aria-label="Giới thiệu MISSPRICE CRM">
          <div className="absolute -top-28 -right-24 w-80 h-80 rounded-full border-[46px] border-white/5" />
          <div className="absolute top-24 -left-40 w-[520px] h-[520px] rounded-full border-[72px] border-white/[0.04]" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm">
              <ShieldCheck size={15} /> Facebook Messenger CRM
            </div>
            <h2 className="mt-8 max-w-xl text-5xl font-bold leading-tight tracking-tight">Chăm sóc khách hàng hiệu quả hơn mỗi ngày</h2>
            <p className="mt-5 max-w-xl text-lg font-medium leading-8 text-blue-50">Quản lý hội thoại, khách hàng và chiến dịch trong một không gian làm việc thống nhất.</p>
          </div>

          <div className="relative z-10 mt-auto translate-x-8 translate-y-12 rotate-[-4deg] rounded-2xl border border-white/30 bg-slate-50 p-4 text-slate-900 shadow-2xl shadow-blue-950/30">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2"><div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center"><MessageCircle size={15} /></div><span className="text-xs font-bold">Trung tâm hội thoại</span></div>
              <div className="h-7 w-24 rounded-md bg-slate-100" />
            </div>
            <div className="grid grid-cols-[150px_1fr] gap-3 pt-3">
              <div className="space-y-2">
                {[['Lan Anh', 'Cần tư vấn sản phẩm'], ['Minh Tuấn', 'Đã gửi số điện thoại'], ['Ngọc Mai', 'Cảm ơn shop nhé']].map(([name, message], index) => (
                  <div key={name} className={`rounded-lg p-2.5 ${index === 0 ? 'bg-blue-50 border border-blue-100' : 'bg-slate-100'}`}><div className="text-[10px] font-bold">{name}</div><div className="mt-1 text-[8px] text-slate-500 truncate">{message}</div></div>
                ))}
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex gap-2">
                  {[{ icon: Users, value: '248', label: 'Khách hàng' }, { icon: MessageCircle, value: '64', label: 'Hội thoại' }, { icon: BarChart3, value: '92%', label: 'Phản hồi' }].map(({ icon: Icon, value, label }) => (
                    <div key={label} className="flex-1 rounded-lg bg-slate-50 p-2"><Icon size={13} className="text-blue-600" /><div className="mt-2 text-sm font-bold">{value}</div><div className="text-[7px] text-slate-500">{label}</div></div>
                  ))}
                </div>
                <div className="mt-4 space-y-2.5"><div className="h-2 w-3/4 rounded bg-slate-100" /><div className="h-2 w-full rounded bg-slate-100" /><div className="h-2 w-5/6 rounded bg-blue-100" /><div className="mt-5 h-24 rounded-lg bg-gradient-to-t from-blue-100 to-blue-50" /></div>
              </div>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
