import { useState } from "react";
import FeatureToast from "../FeatureToast.jsx";

const previewDevices = [
  { name: "Chrome trên Windows", detail: "Máy tính · Hoạt động gần đây", current: true },
  { name: "Safari trên iPhone", detail: "Điện thoại · Hoạt động gần đây", current: false },
];

export default function SecuritySettings() {
  const [toastVersion, setToastVersion] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const notify = () => setToastVersion(value => value + 1);
  const fieldClass = "mt-2 h-11 w-full min-w-0 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-100";

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700" aria-labelledby="devices-heading">
        <div className="border-b border-zinc-100 p-4 dark:border-zinc-800 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 id="devices-heading" className="font-semibold">Quản lý thiết bị</h4>
            <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">Dữ liệu minh họa</span>
          </div>
          <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">Danh sách thiết bị thật sẽ hiển thị khi tính năng được hoàn thiện.</p>
        </div>
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {previewDevices.map(device => <li key={device.name} className="flex flex-wrap items-center gap-3 p-4 sm:p-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300" aria-hidden="true">
              <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                {device.current ? <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4" /></> : <><rect x="6" y="2" width="12" height="20" rx="3" /><path d="M10 18h4" /></>}
              </svg>
            </span>
            <div className="min-w-0 flex-1 basis-32">
              <p className="text-sm font-medium">{device.name}</p>
              <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{device.detail}</p>
              {device.current && <span className="mt-1 inline-block text-xs font-medium text-emerald-600 dark:text-emerald-400">Thiết bị này (minh họa)</span>}
            </div>
            {!device.current && <button type="button" onClick={notify} className="rounded-lg px-3 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-50 focus-visible:ring-2 focus-visible:ring-rose-400 dark:text-rose-400 dark:hover:bg-rose-500/10">Đăng xuất</button>}
          </li>)}
        </ul>
        <div className="border-t border-zinc-100 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-950/20 sm:px-5">
          <button type="button" onClick={notify} className="w-full rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50 focus-visible:ring-2 focus-visible:ring-rose-400 dark:border-rose-900/60 dark:text-rose-400 dark:hover:bg-rose-500/10">Đăng xuất các thiết bị khác</button>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700 sm:p-5" aria-labelledby="password-heading">
        <h4 id="password-heading" className="font-semibold">Đổi mật khẩu</h4>
        <form className="mt-4 space-y-4" onSubmit={event => { event.preventDefault(); notify(); }}>
          {[
            { name: "currentPassword", label: "Mật khẩu hiện tại", autoComplete: "current-password" },
            { name: "newPassword", label: "Mật khẩu mới", autoComplete: "new-password" },
            { name: "confirmPassword", label: "Xác nhận mật khẩu mới", autoComplete: "new-password" },
          ].map(field => <label key={field.name} className="block text-sm font-medium text-zinc-600 dark:text-zinc-300">
            {field.label}
            <input name={field.name} type={showPassword ? "text" : "password"} autoComplete={field.autoComplete} placeholder={field.label} className={fieldClass} />
          </label>)}
          <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <input type="checkbox" checked={showPassword} onChange={event => setShowPassword(event.target.checked)} className="size-4 accent-violet-600" />Hiện mật khẩu
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Tính năng đang được phát triển.</p>
            <button type="submit" className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 focus-visible:ring-4 focus-visible:ring-violet-500/25">Cập nhật mật khẩu</button>
          </div>
        </form>
      </section>
      {toastVersion > 0 && <FeatureToast key={toastVersion} />}
    </div>
  );
}
