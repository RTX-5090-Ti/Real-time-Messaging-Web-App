// src/components/chat/MessageReplyPreview.jsx
export function MessageReplyPreview({ mine, replyTo, replyId, onJumpTo }) {
  if (!replyTo) return null;

  return (
    <button
      type="button"
      onClick={() => onJumpTo?.(replyId)}
      className={[
        "mb-2 w-full text-left rounded-xl px-3 py-2 ring-1",
        mine ? "bg-white/10 ring-white/20" : "bg-zinc-50 ring-zinc-200",
      ].join(" ")}
      title="Jump to original message"
    >
      <div
        className={[
          "text-[11px] font-semibold",
          mine ? "text-white/80" : "text-zinc-600",
        ].join(" ")}
      >
        Reply to {replyTo?.sender?.name || "User"}
      </div>

      <div
        className={[
          "text-xs truncate",
          mine ? "text-white/90" : "text-zinc-700",
        ].join(" ")}
      >
        {String(replyTo.text || "").trim() || "Message"}
      </div>
    </button>
  );
}
