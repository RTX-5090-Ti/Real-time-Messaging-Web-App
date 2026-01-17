import { useMemo, useState } from "react";

const STEP = 6; // 5-8 tuỳ mày

function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "?";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toUpperCase();
}

function avatarFromNameLocal(name) {
  const text = initials(name || "User");
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='64' height='64' rx='32' fill='%23e9d5ff'/><text x='50%25' y='54%25' dominant-baseline='middle' text-anchor='middle' font-family='system-ui' font-size='26' fill='%236b21a8'>${text}</text></svg>`;
  return encodeURIComponent(svg);
}

function isSelfType(t) {
  return (
    t === "friend_request_accepted_self" || t === "friend_request_rejected_self"
  );
}

export default function NotificationsDropdown({
  items = [],
  meId,
  onAccept,
  onReject,
  onClose,
  onClearAll,
}) {
  const [visibleCount, setVisibleCount] = useState(STEP);

  const total = items.length;
  const canLoadMore = visibleCount < total;

  const visibleItems = useMemo(
    () => items.slice(0, visibleCount),
    [items, visibleCount]
  );

  const handleLoadMore = () => {
    setVisibleCount((v) => Math.min(v + STEP, total));
  };

  return (
    <div className="absolute right-0 top-[48px] z-[60] w-[360px] max-w-[86vw]">
      <div className="overflow-hidden bg-white shadow-xl rounded-2xl ring-1 ring-black/10">
        <div className="flex items-center justify-between h-12 px-4 border-b border-zinc-200">
          <div className="font-semibold text-zinc-900">Notifications</div>
          <button
            onClick={onClose}
            className="grid w-8 h-8 transition rounded-xl hover:bg-zinc-100 place-items-center"
            title="Close"
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[360px] overflow-y-auto">
          {total === 0 ? (
            <div className="p-4 text-sm text-zinc-500">No notifications.</div>
          ) : (
            <div className="p-2 space-y-2">
              {visibleItems.map((n) => {
                const type = n.type || "friend_request";
                const isReq = type === "friend_request";

                const actor = n.from || n.by || null;
                const actorId = actor?.id ? String(actor.id) : "";
                const isMeActor = meId && actorId && String(meId) === actorId;

                const name = actor?.name || "User";
                const email = actor?.email || "";
                const avatar =
                  actor?.avatarUrl ||
                  actor?.avatar ||
                  `data:image/svg+xml,${avatarFromNameLocal(name)}`;

                const reqId = n.requestId || n.id;

                const text =
                  type === "friend_request"
                    ? isMeActor
                      ? "You sent a friend request"
                      : "sent you a friend request"
                    : type === "friend_request_accepted"
                    ? isMeActor
                      ? "You accepted a friend request"
                      : "accepted your friend request"
                    : type === "friend_request_rejected"
                    ? isMeActor
                      ? "You rejected a friend request"
                      : "rejected your friend request"
                    : type === "friend_request_accepted_self"
                    ? "accepted the friend request from"
                    : type === "friend_request_rejected_self"
                    ? "rejected the friend request from"
                    : "notification";

                return (
                  <div
                    key={`${n.requestId || n.id}-${type}-${n.createdAt || ""}`}
                    className="p-3 bg-white border rounded-2xl border-zinc-200"
                  >
                    <div className="flex gap-3">
                      <img
                        src={avatar}
                        alt={name}
                        className="object-cover w-11 h-11 rounded-2xl"
                      />

                      <div className="flex-1 min-w-0">
                        {isSelfType(type) ? (
                          <div className="text-sm text-zinc-900">
                            <span className="font-semibold">You</span> {text}{" "}
                            <span className="font-semibold">{name}</span>
                          </div>
                        ) : (
                          <div className="text-sm text-zinc-900">
                            <span className="font-semibold">{name}</span> {text}
                          </div>
                        )}

                        {email ? (
                          <div className="text-xs truncate text-zinc-500">
                            {email}
                          </div>
                        ) : null}

                        {isReq ? (
                          <div className="flex items-center gap-2 mt-3">
                            <button
                              onClick={() => onReject?.(reqId)}
                              className="px-3 text-sm font-semibold transition h-9 rounded-xl bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
                              type="button"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => onAccept?.(reqId)}
                              className="px-3 text-sm font-semibold text-white transition h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700"
                              type="button"
                            >
                              Accept
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-zinc-200">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => onClearAll?.()}
              className="px-3 text-sm font-semibold transition h-9 rounded-xl bg-zinc-100 text-zinc-900 hover:bg-zinc-200 disabled:opacity-50"
              type="button"
              disabled={total === 0}
            >
              Clear all
            </button>

            <button
              onClick={handleLoadMore}
              className="px-3 text-sm font-semibold text-white transition h-9 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
              disabled={!canLoadMore}
            >
              See more
            </button>
          </div>

          <div className="mt-2 text-xs text-zinc-400">
            Showing {Math.min(visibleCount, total)} of {total}
          </div>
        </div>
      </div>
    </div>
  );
}
