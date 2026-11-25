import { useCallback, useEffect, useRef, useState } from "react";
import { AuthAPI } from "../../api/auth.api.js";
import { socket } from "../../socket/socket.js";

const formatDate = value => {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime()) ? date.toLocaleString("vi-VN") : "Chưa có thông tin";
};

export default function DeviceSessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [notice, setNotice] = useState("");
  const version = useRef(0);
  const load = useCallback(async () => {
    const request = ++version.current;
    setLoading(true);
    try {
      const { data } = await AuthAPI.sessions();
      if (request !== version.current) return;
      setSessions(data.sessions); setError("");
    } catch {
      if (request === version.current) setError("Không thể tải danh sách thiết bị. Vui lòng thử lại.");
    } finally { if (request === version.current) setLoading(false); }
  }, []);
  useEffect(() => {
    const invalidate = () => { version.current++; };
    load();
    window.addEventListener("focus", load);
    socket.on("connect", load);
    return () => { invalidate(); window.removeEventListener("focus", load); socket.off("connect", load); };
  }, [load]);
  const revoke = async () => {
    if (!confirmation || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      if (confirmation.current) { await AuthAPI.logout(); return; }
      if (confirmation.id === "others") await AuthAPI.revokeOtherSessions();
      else await AuthAPI.revokeSession(confirmation.id);
      setConfirmation(null);
      setNotice("Đã đăng xuất phiên được chọn.");
      await load();
    } catch { setError("Không thể đăng xuất phiên. Vui lòng thử lại."); }
    finally { setBusy(false); }
  };
  const confirmationPanel = (confirmation && <div className="mt-2 w-full basis-full space-y-3 rounded-xl bg-rose-50 p-4 dark:bg-rose-500/10">
        <p className="text-sm">{confirmation.id === "others" ? "Đăng xuất tất cả phiên khác và giữ phiên hiện tại?" : confirmation.current ? "Đăng xuất phiên hiện tại và quay về trang đăng nhập?" : `Đăng xuất ${confirmation.name}?`}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={revoke} className="cursor-pointer disabled:cursor-not-allowed rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy ? "Đang xử lý…" : "Xác nhận đăng xuất"}</button>
          <button type="button" disabled={busy} onClick={() => setConfirmation(null)} className="cursor-pointer disabled:cursor-not-allowed rounded-lg border border-zinc-300 px-3 py-2 text-xs">Hủy</button>
        </div>
      </div>);
  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700" aria-labelledby="devices-heading">
      <div className="border-b border-zinc-100 p-4 dark:border-zinc-800 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 id="devices-heading" className="font-semibold">Quản lý thiết bị</h4>
          <button type="button" onClick={load} disabled={loading || busy} className="cursor-pointer disabled:cursor-not-allowed text-xs font-medium text-violet-600 disabled:opacity-50 dark:text-violet-300">Làm mới</button>
        </div>
        <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">Các phiên còn hiệu lực, không nhất thiết đang online. Tên thiết bị được suy ra từ trình duyệt.</p>
      </div>
      {error && <div role="alert" className="p-4 text-sm text-rose-600">{error}<button type="button" onClick={load} disabled={busy} className="cursor-pointer disabled:cursor-not-allowed ml-2 underline">Thử lại</button></div>}
      {notice && <p role="status" className="px-4 pt-3 text-sm text-emerald-600">{notice}</p>}

      {loading && <p role="status" className="p-4 text-sm text-zinc-500">Đang tải thiết bị…</p>}
      {!loading && !error && sessions.length === 0 && <p className="p-4 text-sm text-zinc-500">Không có phiên đăng nhập.</p>}
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {sessions.map(session => {
          const name = session.device?.browser ? `${session.device.browser} · ${session.device.os}` : "Thiết bị chưa xác định";
          return <li key={session.id} className="flex flex-wrap items-center gap-3 p-4 sm:p-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300" aria-hidden="true">
              <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                {session.device?.kind === "mobile" ? <><rect x="6" y="2" width="12" height="20" rx="3" /><path d="M10 18h4" /></> : <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4" /></>}
              </svg>
            </span>
            <div className="min-w-0 flex-1 basis-32">
              <p className="text-sm font-medium">{name}</p>
              <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">Đăng nhập: {formatDate(session.createdAt)}<br />Hoạt động gần nhất: {formatDate(session.lastUsedAt)}</p>
              {session.current && <span className="mt-1 inline-block text-xs font-medium text-emerald-600 dark:text-emerald-400">Phiên hiện tại</span>}
            </div>
            <button type="button" disabled={busy || loading} onClick={() => { setNotice(""); setConfirmation({ ...session, name }); }} className="cursor-pointer disabled:cursor-not-allowed rounded-lg px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:text-rose-400 dark:hover:bg-rose-500/10">Đăng xuất</button>
            {confirmation?.id === session.id && confirmationPanel}
          </li>;
        })}
      </ul>
      <div className="border-t border-zinc-100 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-950/20 sm:px-5">
        <button type="button" disabled={busy || loading || !sessions.some(s => !s.current)} onClick={() => { setNotice(""); setConfirmation({ id: "others" }); }} className="cursor-pointer disabled:cursor-not-allowed w-full rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-900/60 dark:text-rose-400 dark:hover:bg-rose-500/10">Đăng xuất các thiết bị khác</button>
        {confirmation?.id === "others" && confirmationPanel}
      </div>
    </section>
  );
}
