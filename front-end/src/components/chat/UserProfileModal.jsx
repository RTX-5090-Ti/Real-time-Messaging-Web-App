import { useEffect, useMemo, useState } from "react";
import { UserAPI } from "../../api/user.api.js";
import { avatarFromName } from "../../utils/chatUi.js";

const fmtDobVN = (dob) => {
  const s = String(dob || "").trim();
  if (!s) return "";
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return "";
  return `${d} tháng ${m}, ${y}`;
};

/**
 * View-only profile modal for other users.
 * UI giống ProfileModal (view screen) nhưng không có edit / upload avatar.
 */
export default function UserProfileModal({
  open,
  onClose,
  userId,
  // optional seed so UI show instantly while fetching
  seedUser,
}) {
  const [busy, setBusy] = useState(false);
  const [u, setU] = useState(seedUser || null);

  // keep seed in sync (khi click từ conversation khác)
  useEffect(() => {
    if (!open) return;
    setU(seedUser || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userId]);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const id = String(userId || "");
    if (!id) return;

    let cancelled = false;
    setBusy(true);

    UserAPI.getById(id)
      .then((res) => {
        if (cancelled) return;
        const user = res?.data?.user;
        if (user) setU(user);
      })
      .catch(() => {
        // ignore: keep seedUser
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  const coverUrl = useMemo(() => {
    const seed = encodeURIComponent(String(u?.id || userId || 1));
    return `https://picsum.photos/1200/420?random=${seed}`;
  }, [u?.id, userId]);

  const name = u?.name || "User";
  const email = u?.email || "-";
  const genderLabel =
    u?.gender === "male" ? "Nam" : u?.gender === "female" ? "Nữ" : "";
  const dobLabel = fmtDobVN(u?.dob);

  const avatarSrc =
    u?.avatarUrl ||
    u?.avatar ||
    (name ? avatarFromName(name) : avatarFromName("User"));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[140]">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => !busy && onClose?.()}
      />

      <div className="absolute inset-0 grid p-4 place-items-center">
        <div className="w-full max-w-[520px] rounded-2xl overflow-hidden bg-white text-zinc-900 shadow-2xl ring-1 ring-zinc-200">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-white/95 border-zinc-200">
            <div className="font-semibold">Account information</div>

            <button
              type="button"
              className="grid cursor-pointer w-9 h-9 place-items-center rounded-xl hover:bg-zinc-100"
              onClick={() => !busy && onClose?.()}
              title="Close"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M18 6L6 18M6 6l12 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <div>
            <div className="relative h-[170px] bg-zinc-100">
              <img
                src={coverUrl}
                alt=""
                className="object-cover w-full h-full"
              />

              <div className="absolute flex items-end gap-3 -bottom-9 left-4">
                <div className="w-[88px] h-[88px] rounded-full overflow-hidden ring-4 ring-white shadow-md bg-white">
                  <img
                    src={avatarSrc}
                    alt={name}
                    className="object-cover w-full h-full"
                  />
                </div>
              </div>
            </div>

            <div className="px-4 pt-12 pb-4">
              <div className="text-2xl font-semibold">{name}</div>

              <div className="p-4 mt-5 rounded-2xl bg-zinc-50 ring-1 ring-zinc-200">
                <div className="mb-3 text-lg font-semibold">
                  Personal information
                </div>

                <div className="grid grid-cols-[140px_1fr] gap-y-3 text-sm">
                  <div className="text-zinc-500">Sex</div>
                  <div>
                    {genderLabel || (
                      <span className="text-zinc-400">Not yet updated</span>
                    )}
                  </div>

                  <div className="text-zinc-500">Date of birth</div>
                  <div>
                    {dobLabel || (
                      <span className="text-zinc-400">Not yet updated</span>
                    )}
                  </div>

                  <div className="text-zinc-500">Email</div>
                  <div className="break-all">{email}</div>
                </div>
              </div>

              {busy ? (
                <div className="mt-3 text-xs text-zinc-500">Loading...</div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
