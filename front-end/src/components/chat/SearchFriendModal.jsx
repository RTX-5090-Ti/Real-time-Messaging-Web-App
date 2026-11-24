import { useEffect, useMemo, useRef, useState } from "react";
import { socket } from "../../socket/socket.js";

export default function SearchFriendModal({
  open,
  onClose,
  onSearchEmail, // async (email) => { user, relationship, incomingRequestId, outgoingRequestId }
  onSendRequest, // async (toUserId) => void
  onCancelRequest,
  onAccept, // async (requestId) => void
  onReject, // async (requestId) => void
}) {
  const inputRef = useRef(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [result, setResult] = useState(null); // { user, relationship, incomingRequestId, outgoingRequestId }
  useEffect(() => {
    if (!open || !result?.user?.email) return;
    let active = true;
    const sync = payload => {
      if (payload && ![payload.fromUserId, payload.toUserId].includes(String(result.user.id))) return;
      onSearchEmail(result.user.email).then(data => { if (active) setResult(data); }).catch(() => {});
    };
    socket.on("friend:request-updated", sync);
    socket.on("connect", sync);
    return () => { active = false; socket.off("friend:request-updated", sync); socket.off("connect", sync); };
  }, [open, result?.user?.email, result?.user?.id, onSearchEmail]);

  useEffect(() => {
    if (!open) return;
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setEmail("");
      setErr("");
      setResult(null);
      setLoading(false);
    }
  }, [open]);

  const title = useMemo(() => {
    if (!result) return "Find friend";
    return "Result";
  }, [result]);

  const relationship = result?.relationship;

  const submit = async () => {
    const v = email.trim().toLowerCase();
    if (!v) return;

    setErr("");
    setLoading(true);
    try {
      const data = await onSearchEmail(v);

      // ✅ nếu backend trả user null -> show error rõ ràng
      if (!data?.user) {
        setResult(null);
        setErr("User not found");
        return;
      }

      setResult(data);
    } catch (e) {
      setResult(null);
      setErr(e?.message || "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const onAddFriend = async () => {
    if (!result?.user?.id) return;
    setErr("");
    setLoading(true);
    try {
      const request = await onSendRequest(result.user.id);
      // update UI locally
      setResult((prev) =>
        prev ? { ...prev, relationship: "outgoing_pending", outgoingRequestId: String(request.id) } : prev
      );
    } catch (e) {
      setErr(e?.message || "Failed to send request");
    } finally {
      setLoading(false);
    }
  };

  const onAcceptClick = async () => {
    const reqId = result?.incomingRequestId;
    if (!reqId) return;
    setErr("");
    setLoading(true);
    try {
      await onAccept(reqId);
      setResult((prev) => (prev ? { ...prev, relationship: "friends" } : prev));
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Failed to accept");
      onSearchEmail(result.user.email).then(setResult).catch(() => {});
    } finally {
      setLoading(false);
    }
  };

  const onCancelClick = async () => {
    if (!result?.outgoingRequestId || loading) return;
    setErr(""); setLoading(true);
    try {
      await onCancelRequest(result.outgoingRequestId);
      setResult(prev => prev ? { ...prev, relationship: "none", outgoingRequestId: null } : prev);
    } catch (error) {
      setErr(error?.response?.data?.message || "Không thể hủy lời mời");
      onSearchEmail(result.user.email).then(setResult).catch(() => {});
    } finally { setLoading(false); }
  };

  const onRejectClick = async () => {
    const reqId = result?.incomingRequestId;
    if (!reqId) return;
    setErr("");
    setLoading(true);
    try {
      await onReject(reqId);
      setResult((prev) => (prev ? { ...prev, relationship: "none" } : prev));
    } catch (e) {
      setErr(e?.message || "Failed to reject");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

      {/* modal */}
      <div className="relative w-[520px] max-w-[92vw] rounded-3xl bg-white shadow-2xl ring-1 ring-black/10 overflow-hidden">
        <div className="flex items-center justify-between px-5 border-b h-14 border-zinc-200">
          <div className="font-semibold text-zinc-900">{title}</div>

          <button
            className="grid transition w-9 h-9 rounded-xl hover:bg-zinc-100 place-items-center"
            onClick={onClose}
            title="Close"
            type="button"
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
          <div className="flex items-center gap-2">
            <div className="flex-1 px-4 py-3 border rounded-2xl border-zinc-200 bg-zinc-50">
              <input
                ref={inputRef}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
                placeholder="Enter email…"
                className="w-full text-sm bg-transparent outline-none text-zinc-900 placeholder:text-zinc-400"
              />
            </div>

            <button
              onClick={submit}
              disabled={loading || !email.trim()}
              className={[
                "h-11 px-4 rounded-2xl font-semibold text-sm transition",
                loading || !email.trim()
                  ? "bg-zinc-200 text-zinc-500 cursor-not-allowed"
                  : "bg-violet-600 text-white hover:bg-violet-700",
              ].join(" ")}
              type="button"
            >
              {loading ? "Searching…" : "Search"}
            </button>
          </div>

          {err ? (
            <div className="px-4 py-3 text-sm text-red-600 border border-red-100 bg-red-50 rounded-2xl">
              {err}
            </div>
          ) : null}

          {/* Result card */}
          {result?.user ? (
            <div className="p-4 bg-white border rounded-3xl border-zinc-200">
              <div className="flex items-center gap-4">
                <img
                  src={result.user.avatar}
                  alt={result.user.name}
                  className="object-cover w-14 h-14 rounded-2xl"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate text-zinc-900">
                    {result.user.name}
                  </div>
                  <div className="text-sm truncate text-zinc-500">
                    {result.user.email}
                  </div>
                </div>

                {/* Action buttons by relationship */}
                <div className="flex items-center gap-2 shrink-0">
                  {relationship === "self" ? (
                    <span className="text-sm font-semibold text-zinc-500">
                      That’s you 🙂
                    </span>
                  ) : relationship === "friends" ? (
                    <span className="text-sm font-semibold text-emerald-600">
                      Friends
                    </span>
                  ) : relationship === "outgoing_pending" ? (
                    <button
                      disabled={loading}
                      onClick={onCancelClick}
                      className="h-10 px-4 text-sm font-semibold rounded-2xl bg-zinc-100 text-zinc-700 hover:bg-zinc-200 disabled:opacity-50 cursor-pointer"
                      type="button"
                    >
                      Hủy lời mời
                    </button>
                  ) : relationship === "incoming_pending" ? (
                    <>
                      <button
                        onClick={onRejectClick}
                        disabled={loading}
                        className="h-10 px-4 text-sm font-semibold transition rounded-2xl bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
                        type="button"
                      >
                        Reject
                      </button>
                      <button
                        onClick={onAcceptClick}
                        disabled={loading}
                        className="h-10 px-4 text-sm font-semibold text-white transition rounded-2xl bg-emerald-600 hover:bg-emerald-700"
                        type="button"
                      >
                        Accept
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={onAddFriend}
                      disabled={loading}
                      className="h-10 px-4 text-sm font-semibold text-white transition rounded-2xl bg-violet-600 hover:bg-violet-700"
                      type="button"
                    >
                      Add friend
                    </button>
                  )}
                </div>
              </div>

              {relationship === "incoming_pending" ? (
                <div className="mt-3 text-xs text-zinc-500">
                  This user sent you a friend request.
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="text-xs text-zinc-400">
            Tip: search by exact email.
          </div>
        </div>
      </div>
    </div>
  );
}
