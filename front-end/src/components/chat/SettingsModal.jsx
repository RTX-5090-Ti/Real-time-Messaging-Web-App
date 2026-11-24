import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ProfileModal from "./ProfileModal.jsx";
import SecuritySettings from "./SecuritySettings.jsx";

const sections = [
  { id: "theme", label: "Theme" },
  { id: "profile", label: "Profile" },
  { id: "security", label: "Đăng nhập và bảo mật" },
];
const themes = [
  { id: "light", label: "Light", description: "Sáng và rõ ràng" },
  { id: "dark", label: "Dark", description: "Dịu mắt vào ban đêm" },
  { id: "system", label: "System", description: "Theo cài đặt thiết bị" },
];

export default function SettingsModal({ onClose, themeMode, setThemeMode, me, setMe }) {
  const [section, setSection] = useState("theme");
  const panel = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const onKey = event => {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); }
      if (event.key !== "Tab") return;
      const nodes = [...panel.current.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]')].filter(node => !node.hidden && node.getClientRects().length);
      const first = nodes[0], last = nodes.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  const current = sections.find(item => item.id === section);

  return createPortal(
    <div className="fixed inset-0 z-[130] grid place-items-center bg-slate-950/45 p-3 backdrop-blur-sm sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="settings-title" className="settings-dialog flex h-[min(680px,90dvh)] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/60 bg-white text-zinc-900 shadow-2xl outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
        <header className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800 sm:px-7">
          <h2 id="settings-title" className="text-xl font-semibold tracking-tight">Settings</h2>
          <button type="button" onClick={onClose} aria-label="Close settings" className="grid size-9 cursor-pointer place-items-center rounded-xl text-zinc-500 hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-violet-500 dark:hover:bg-zinc-800">✕</button>
        </header>
        <div className="flex min-h-0 flex-1">
          <nav aria-label="Settings sections" className="w-28 shrink-0 space-y-2 border-r border-zinc-100 bg-zinc-50/80 p-2 dark:border-zinc-800 dark:bg-zinc-950/40 sm:w-48 sm:p-4">
            {sections.map(item => <button type="button" key={item.id} aria-current={section === item.id ? "page" : undefined} onClick={() => setSection(item.id)} className={`w-full cursor-pointer rounded-xl px-3 py-3 text-left text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-violet-500 ${section === item.id ? "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300" : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"}`}>{item.label}</button>)}
          </nav>
          <section aria-label={current.label} className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-7">
            <h3 className="text-lg font-semibold">{current.label}</h3>
            <div className="h-6" aria-hidden="true" />
            {section === "theme" ? <fieldset><legend className="mb-3 text-sm font-medium">Giao diện</legend>
              <div className="grid gap-3 lg:grid-cols-3">{themes.map(mode => <label key={mode.id} className={`relative cursor-pointer rounded-2xl border-2 p-3 transition ${themeMode === mode.id ? "border-violet-500 bg-violet-50/50 dark:bg-violet-500/10" : "border-zinc-200 hover:border-violet-300 dark:border-zinc-700"}`}>
                <input type="radio" name="settings-theme" value={mode.id} checked={themeMode === mode.id} onChange={() => setThemeMode(mode.id)} className="absolute right-3 top-3 size-4 accent-violet-600" />
                <div aria-hidden="true" className={`mb-4 mt-5 flex h-20 gap-2 overflow-hidden rounded-lg border p-2 ${mode.id === "dark" ? "border-zinc-700 bg-zinc-900" : mode.id === "system" ? "border-zinc-300 bg-gradient-to-r from-white from-50% to-zinc-900 to-50%" : "border-zinc-200 bg-white"}`}>
                  <div className="w-1/4 rounded bg-violet-400/30" /><div className="flex-1 space-y-2 pt-1"><div className="h-2 w-3/4 rounded bg-violet-400/50" /><div className="h-2 rounded bg-zinc-400/30" /><div className="ml-auto h-4 w-2/3 rounded bg-violet-500" /></div>
                </div>
                <span className="block text-sm font-semibold">{mode.label}</span><span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">{mode.description}</span>
              </label>)}</div>
              <p className="mt-5 text-xs text-zinc-500 dark:text-zinc-400">Thay đổi được áp dụng ngay và lưu trên trình duyệt này.</p>
            </fieldset> : section === "profile" ? <ProfileModal open embedded me={me} setMe={setMe} /> : <SecuritySettings />}
          </section>
        </div>
      </div>
    </div>, document.body,
  );
}
