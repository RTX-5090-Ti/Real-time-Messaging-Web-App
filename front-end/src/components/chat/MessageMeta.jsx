// src/components/chat/MessageMeta.jsx
export function MessageMeta({ mine, msg, onRetry }) {
  return (
    <div
      className={[
        "mt-2 text-[11px]",
        mine ? "text-white/70" : "text-zinc-500",
      ].join(" ")}
    >
      {msg.time}
      {msg.status === "sending" ? " • Sending…" : ""}
      {msg.status === "failed" ? (
        <>
          {" • "}
          <button
            type="button"
            onClick={() => onRetry?.(msg)}
            className="underline underline-offset-2 hover:opacity-80"
          >
            Retry
          </button>
        </>
      ) : null}
    </div>
  );
}
