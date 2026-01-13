// src/components/chat/MessageReactionsLine.jsx
export function MessageReactionsLine({ mine, reactionLine }) {
  if (!reactionLine) return null;

  return (
    <div
      className={["mt-1 flex", mine ? "justify-end" : "justify-start"].join(
        " "
      )}
    >
      <span
        className={[
          "inline-flex items-center gap-2 rounded-full px-3 py-1 ring-1 text-s mt-[-15px]",
          mine
            ? "bg-white/10 ring-white/20 text-white/90"
            : "bg-zinc-50 ring-zinc-200 text-zinc-700",
        ].join(" ")}
      >
        {reactionLine}
      </span>
    </div>
  );
}
