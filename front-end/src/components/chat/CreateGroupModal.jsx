import { useEffect, useMemo, useRef, useState } from "react";

export default function CreateGroupModal({
  open,
  onClose,
  friends = [],
  onCreate, // async ({ name, memberIds }) => void
}) {
  const nameRef = useRef(null);

  const [groupName, setGroupName] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState([]); // array of friend ids
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setTimeout(() => nameRef.current?.focus(), 40);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setGroupName("");
      setQ("");
      setSelected([]);
      setBusy(false);
      setErr("");
    }
  }, [open]);

  const norm = (s) =>
    String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  const filtered = useMemo(() => {
    const qq = norm(q);
    const list = Array.isArray(friends) ? friends : [];
    if (!qq) return list;
    return list.filter((f) => norm(f?.name).includes(qq));
  }, [friends, q]);

  const toggle = (id) => {
    const fid = String(id);
    setSelected((prev) => {
      const s = new Set(prev.map(String));
      if (s.has(fid)) s.delete(fid);
      else s.add(fid);
      return [...s];
    });
  };

  const selectedFriends = useMemo(() => {
    const map = new Map((friends || []).map((f) => [String(f.id), f]));
    return selected.map((id) => map.get(String(id))).filter(Boolean);
  }, [selected, friends]);

  const canCreate =
    String(groupName || "").trim().length > 0 && selected.length >= 2 && !busy;

  const submit = async () => {
    if (!canCreate) return;
    setErr("");
    setBusy(true);
    try {
      await onCreate?.({
        name: String(groupName).trim(),
        memberIds: selected.map(String),
      });
      onClose?.();
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Create group failed");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

      <div className="relative w-[640px] max-w-[92vw] rounded-3xl bg-white shadow-2xl ring-1 ring-black/10 overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between px-5 border-b h-14 border-zinc-200">
          <div className="font-semibold text-zinc-900">Create group chat</div>

          <button
            className="grid transition w-9 h-9 rounded-xl hover:bg-zinc-100 place-items-center"
            onClick={onClose}
            title="Close"
            type="button"
            disabled={busy}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M18 6 6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* group name */}
          <div className="space-y-2">
            <div className="text-sm font-semibold text-zinc-900">
              Group name
            </div>
            <div className="px-4 py-3 border rounded-2xl border-zinc-200 bg-zinc-50">
              <input
                ref={nameRef}
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="VD: Team Code 2026"
                className="w-full text-sm bg-transparent outline-none text-zinc-900 placeholder:text-zinc-400"
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
              />
            </div>
          </div>

          {/* selected chips */}
          <div className="space-y-2">
            <div className="text-sm font-semibold text-zinc-900">
              Members ({selected.length})
            </div>

            {selectedFriends.length ? (
              <div className="flex flex-wrap gap-2">
                {selectedFriends.map((f) => (
                  <button
                    key={String(f.id)}
                    type="button"
                    className="flex items-center gap-2 px-3 rounded-full cursor-pointer h-9 bg-violet-50 text-violet-700 ring-1 ring-violet-200 hover:bg-violet-100"
                    onClick={() => toggle(f.id)}
                    title="Remove"
                  >
                    <img
                      src={f.avatar}
                      alt={f.name}
                      className="object-cover w-6 h-6 rounded-full"
                    />
                    <span className="text-sm font-medium">{f.name}</span>
                    <span className="ml-1 text-violet-500">✕</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-sm text-zinc-500">
                Pick at least <b>2 friends</b> to create a group.
              </div>
            )}
          </div>

          {/* friend search */}
          <div className="flex items-center gap-2">
            <div className="flex-1 px-4 py-3 border rounded-2xl border-zinc-200 bg-zinc-50">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search friends…"
                className="w-full text-sm bg-transparent outline-none text-zinc-900 placeholder:text-zinc-400"
              />
            </div>

            <button
              onClick={submit}
              disabled={!canCreate}
              className={[
                "h-11 px-4 rounded-2xl font-semibold text-sm transition",
                canCreate
                  ? "bg-violet-600 text-white hover:bg-violet-700 cursor-pointer"
                  : "bg-zinc-200 text-zinc-500 cursor-not-allowed",
              ].join(" ")}
              type="button"
            >
              {busy ? "Creating…" : "Create"}
            </button>
          </div>

          {err ? (
            <div className="px-4 py-3 text-sm text-red-600 border border-red-100 bg-red-50 rounded-2xl">
              {err}
            </div>
          ) : null}

          {/* friend list */}
          <div className="overflow-hidden border rounded-3xl border-zinc-200">
            <div className="max-h-[340px] overflow-auto">
              {(filtered || []).map((f) => {
                const checked = selected.includes(String(f.id));
                return (
                  <button
                    key={String(f.id)}
                    type="button"
                    onClick={() => toggle(f.id)}
                    className={[
                      "w-full flex items-center gap-3 px-4 py-3 text-left transition cursor-pointer",
                      checked ? "bg-violet-50" : "hover:bg-zinc-50",
                    ].join(" ")}
                  >
                    <img
                      src={f.avatar}
                      alt={f.name}
                      className="object-cover w-10 h-10 rounded-2xl"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate text-zinc-900">
                        {f.name}
                      </div>
                      <div className="text-sm truncate text-zinc-500">
                        {f.email || ""}
                      </div>
                    </div>

                    <div
                      className={[
                        "w-5 h-5 rounded-md border grid place-items-center",
                        checked
                          ? "bg-violet-600 border-violet-600 text-white"
                          : "border-zinc-300 text-transparent",
                      ].join(" ")}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M20 6 9 17l-5-5"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </button>
                );
              })}

              {!filtered?.length ? (
                <div className="p-4 text-sm text-zinc-500">
                  No friends found.
                </div>
              ) : null}
            </div>
          </div>

          <div className="text-xs text-zinc-400">
            Tip: Group chat needs at least <b>3 people</b> (you + 2 friends).
          </div>
        </div>
      </div>
    </div>
  );
}
