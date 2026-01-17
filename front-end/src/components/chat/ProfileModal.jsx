import { useEffect, useMemo, useRef, useState } from "react";
import { UserAPI } from "../../api/user.api.js";
import { avatarFromName } from "../../utils/chatUi.js";

const fmtDobVN = (dob) => {
  const s = String(dob || "").trim();
  if (!s) return "";
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return "";
  return `${d} tháng ${m}, ${y}`;
};

const parseDob = (dob) => {
  const s = String(dob || "").trim();
  if (!s) return { day: "", month: "", year: "" };
  const [y, m, d] = s.split("-");
  return { day: d || "", month: m || "", year: y || "" };
};

const buildDob = ({ day, month, year }) => {
  if (!day || !month || !year) return "";
  const dd = String(day).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  const yy = String(year);
  return `${yy}-${mm}-${dd}`;
};

export default function ProfileModal({ open, onClose, me, setMe }) {
  const [screen, setScreen] = useState("view"); // view | edit
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [gender, setGender] = useState(""); // male | female | ""
  const [dob, setDob] = useState({ day: "", month: "", year: "" });

  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setScreen("view");
    setBusy(false);
    setName(me?.name || "");
    setGender(me?.gender || "");
    setDob(parseDob(me?.dob));
  }, [open, me?.name, me?.gender, me?.dob]);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  const coverUrl = useMemo(() => {
    const seed = encodeURIComponent(String(me?.id || 1));
    return `https://picsum.photos/1200/420?random=${seed}`;
  }, [me?.id]);

  const genderLabel =
    me?.gender === "male" ? "Nam" : me?.gender === "female" ? "Nữ" : "";

  const dobLabel = fmtDobVN(me?.dob);

  const pickAvatar = () => {
    if (busy) return;
    fileRef.current?.click();
  };

  const onAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!String(file.type || "").startsWith("image/")) {
      alert("Chỉ nhận file ảnh");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      alert("Ảnh quá lớn (tối đa ~6MB)");
      return;
    }

    setBusy(true);
    try {
      const res = await UserAPI.updateAvatar(file);
      const avatarUrl = res?.data?.avatarUrl || res?.data?.user?.avatarUrl;
      if (avatarUrl) {
        setMe((prev) => ({ ...(prev || {}), avatar: avatarUrl, avatarUrl }));
      }
    } catch (err) {
      alert(err?.response?.data?.message || "Upload avatar failed");
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = async () => {
    if (busy) return;

    const safeName = String(name || "").trim();
    if (!safeName) return alert("Tên hiển thị không được trống");

    const payload = {
      name: safeName,
      gender: gender || "",
      dob: buildDob(dob) || "",
    };

    setBusy(true);
    try {
      const res = await UserAPI.updateMe(payload);
      const u = res?.data?.user;

      setMe((prev) => {
        const next = { ...(prev || {}) };

        next.name = u?.name ?? safeName;
        next.gender = u?.gender || "";
        next.dob = u?.dob || "";
        next.email = u?.email ?? next.email;

        const serverAvatar = u?.avatarUrl || "";
        if (serverAvatar) {
          next.avatar = serverAvatar;
          next.avatarUrl = serverAvatar;
        } else {
          const cur = String(next.avatar || "");
          if (cur.startsWith("data:image/svg+xml")) {
            next.avatar = avatarFromName(next.name || "User");
          }
          next.avatarUrl = "";
        }

        return next;
      });

      setScreen("view");
    } catch (err) {
      alert(err?.response?.data?.message || "Update profile failed");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120]">
      {/* overlay */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => !busy && onClose?.()}
      />

      {/* modal */}
      <div className="absolute inset-0 grid p-4 place-items-center">
        <div className="w-full max-w-[520px] rounded-2xl overflow-hidden bg-white text-zinc-900 shadow-2xl ring-1 ring-zinc-200">
          {/* header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-white/95 border-zinc-200">
            <div className="flex items-center gap-2">
              {screen === "edit" ? (
                <button
                  type="button"
                  className="grid cursor-pointer w-9 h-9 place-items-center rounded-xl hover:bg-zinc-100"
                  onClick={() => !busy && setScreen("view")}
                  title="Back"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M15 18l-6-6 6-6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              ) : null}

              <div className="font-semibold">
                {screen === "edit"
                  ? "Update personal information"
                  : "Account information"}
              </div>
            </div>

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

          {screen === "view" ? (
            <div>
              {/* cover */}
              <div className="relative h-[170px] bg-zinc-100">
                <img
                  src={coverUrl}
                  alt=""
                  className="object-cover w-full h-full"
                />

                {/* avatar */}
                <div className="absolute flex items-end gap-3 -bottom-9 left-4">
                  <div className="relative">
                    <div className="w-[88px] h-[88px] rounded-full overflow-hidden ring-4 ring-white shadow-md bg-white">
                      <img
                        src={me?.avatar}
                        alt="me"
                        className="object-cover w-full h-full"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={pickAvatar}
                      title="Upload avatar"
                      className="absolute grid w-10 h-10 bg-white rounded-full shadow-sm cursor-pointer -right-1 -bottom-1 ring-1 ring-zinc-200 place-items-center hover:bg-zinc-50"
                      disabled={busy}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M4 7h4l2-2h4l2 2h4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinejoin="round"
                        />
                        <circle
                          cx="12"
                          cy="13"
                          r="3"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                      </svg>
                    </button>

                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={onAvatarChange}
                    />
                  </div>
                </div>
              </div>

              <div className="px-4 pt-12 pb-4">
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-semibold">
                    {me?.name || "User"}
                  </div>
                  <button
                    type="button"
                    className="grid cursor-pointer w-9 h-9 rounded-xl place-items-center hover:bg-zinc-100"
                    title="Edit"
                    onClick={() => !busy && setScreen("edit")}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 20h9"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <path
                        d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>

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
                    <div className="break-all">{me?.email || "-"}</div>
                  </div>
                </div>

                <button
                  type="button"
                  className="flex items-center justify-center w-full gap-2 mt-4 text-white shadow-sm cursor-pointer h-11 rounded-2xl bg-violet-600 hover:bg-violet-500"
                  onClick={() => !busy && setScreen("edit")}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 20h9"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="font-medium">Update</span>
                </button>

                {busy ? (
                  <div className="mt-3 text-xs text-zinc-500">
                    Processing...
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="p-4">
              <div className="space-y-3">
                <div>
                  <div className="mb-1 text-sm text-zinc-600">Display name</div>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 bg-white border outline-none h-11 rounded-2xl border-zinc-200 focus:ring-2 focus:ring-violet-200"
                    placeholder="Nhập tên hiển thị"
                  />
                </div>

                <div className="pt-2">
                  <div className="mb-2 text-lg font-semibold">
                    Personal information
                  </div>

                  <div className="flex items-center gap-6 text-sm">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="radio"
                        name="gender"
                        className="accent-violet-600"
                        checked={gender === "male"}
                        onChange={() => setGender("male")}
                      />
                      <span>Male</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="radio"
                        name="gender"
                        className="accent-violet-600"
                        checked={gender === "female"}
                        onChange={() => setGender("female")}
                      />
                      <span>Female</span>
                    </label>

                    <button
                      type="button"
                      className="ml-auto text-xs cursor-pointer text-zinc-500 hover:text-zinc-800"
                      onClick={() => !busy && setGender("")}
                      title="Clear gender"
                    >
                      Deselect
                    </button>
                  </div>

                  <div className="mt-4">
                    <div className="mb-1 text-sm text-zinc-600">
                      Date of birth
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <select
                        value={dob.day}
                        onChange={(e) =>
                          setDob((p) => ({ ...p, day: e.target.value }))
                        }
                        className="px-3 bg-white border outline-none h-11 rounded-2xl border-zinc-200 focus:ring-2 focus:ring-violet-200"
                      >
                        <option value="">DD</option>
                        {Array.from({ length: 31 }, (_, i) => {
                          const v = String(i + 1).padStart(2, "0");
                          return (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          );
                        })}
                      </select>

                      <select
                        value={dob.month}
                        onChange={(e) =>
                          setDob((p) => ({ ...p, month: e.target.value }))
                        }
                        className="px-3 bg-white border outline-none h-11 rounded-2xl border-zinc-200 focus:ring-2 focus:ring-violet-200"
                      >
                        <option value="">MM</option>
                        {Array.from({ length: 12 }, (_, i) => {
                          const v = String(i + 1).padStart(2, "0");
                          return (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          );
                        })}
                      </select>

                      <select
                        value={dob.year}
                        onChange={(e) =>
                          setDob((p) => ({ ...p, year: e.target.value }))
                        }
                        className="px-3 bg-white border outline-none h-11 rounded-2xl border-zinc-200 focus:ring-2 focus:ring-violet-200"
                      >
                        <option value="">YYYY</option>
                        {Array.from({ length: 90 }, (_, i) => {
                          const y = new Date().getFullYear() - i;
                          return (
                            <option key={y} value={String(y)}>
                              {y}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <button
                      type="button"
                      className="mt-2 text-xs cursor-pointer text-zinc-500 hover:text-zinc-800"
                      onClick={() =>
                        !busy && setDob({ day: "", month: "", year: "" })
                      }
                    >
                      Delete date of birth
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    className="px-5 bg-white border cursor-pointer h-11 rounded-2xl border-zinc-200 hover:bg-zinc-50"
                    onClick={() => !busy && setScreen("view")}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    className="px-5 text-white cursor-pointer h-11 rounded-2xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60"
                    onClick={saveProfile}
                  >
                    Update
                  </button>
                </div>

                {busy ? (
                  <div className="text-xs text-zinc-500">Processing...</div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
