// src/components/chat/HighlightedText.jsx
export function HighlightedText({ text, query = "", mine = false }) {
  const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const q = String(query || "").trim();
  if (!q) return <>{text}</>;

  const raw = String(text || "");
  const re = new RegExp(`(${escapeRegExp(q)})`, "ig");
  const parts = raw.split(re);

  const markClass = [
    "rounded px-0.5",
    mine ? "bg-white/20 text-white" : "bg-yellow-200",
  ].join(" ");

  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark key={i} className={markClass}>
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}
