import { useMemo, useState } from "react";

export default function AddMemberModal({
  open,
  onClose,
  friends = [],
  existingMemberIds = [],
  onPick,
}) {
  const [q, setQ] = useState("");

  const memberSet = useMemo(
    () => new Set((existingMemberIds || []).map(String)),
    [existingMemberIds]
  );

  const filtered = useMemo(() => {
    const key = q.trim().toLowerCase();
    if (!key) return friends;

    return friends.filter((f) => {
      const name = String(f.name || "").toLowerCase();
      const email = String(f.email || "").toLowerCase();
      return name.includes(key) || email.includes(key);
    });
  }, [friends, q]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[240]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="absolute inset-0 grid p-4 place-items-center">
        <div className="w-full max-w-[420px] rounded-2xl bg-white border border-zinc-200 shadow-xl p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-bold text-zinc-900">Add member</h3>
            <button
              type="button"
              className="grid border w-9 h-9 place-items-center rounded-xl border-zinc-200 hover:bg-zinc-50"
              onClick={onClose}
              title="Close"
            >
              ✕
            </button>
          </div>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search your friends..."
            className="w-full h-10 px-3 mt-3 text-sm border outline-none rounded-xl border-zinc-200 focus:ring-2 focus:ring-violet-200"
          />

          <div className="mt-3 max-h-[360px] overflow-auto space-y-2">
            {filtered.map((f) => {
              const isInGroup = memberSet.has(String(f.id));

              return (
                <button
                  key={String(f.id)}
                  type="button"
                  disabled={isInGroup}
                  onClick={() => onPick?.(f)}
                  className={[
                    "w-full flex items-center gap-3 p-3 rounded-2xl border text-left",
                    isInGroup
                      ? "border-zinc-200 bg-zinc-50 opacity-60 cursor-not-allowed"
                      : "border-zinc-200 hover:bg-zinc-50 cursor-pointer",
                  ].join(" ")}
                >
                  <img
                    src={f.avatar}
                    alt={f.name}
                    className="object-cover w-10 h-10 rounded-full shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate text-zinc-900">
                      {f.name}
                    </p>
                    <p className="text-xs truncate text-zinc-500">
                      {f.email || ""}
                    </p>
                  </div>

                  {isInGroup ? (
                    <span className="text-xs text-zinc-500">In group</span>
                  ) : (
                    <span className="text-xs font-semibold text-violet-600">
                      Add
                    </span>
                  )}
                </button>
              );
            })}

            {!filtered.length ? (
              <div className="py-6 text-sm text-center text-zinc-500">
                No friends found.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
