import { useState } from "react";
import FeatureToast from "../FeatureToast.jsx";

import DeviceSessions from "./DeviceSessions.jsx";

export default function SecuritySettings() {
  const [toastVersion, setToastVersion] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const notify = () => setToastVersion(value => value + 1);
  const fieldClass = "mt-2 h-11 w-full min-w-0 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-100";

  return (
    <div className="space-y-6">
      <DeviceSessions />

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
