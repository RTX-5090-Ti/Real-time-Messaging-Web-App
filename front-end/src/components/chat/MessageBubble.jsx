export function MessageBubble({
  msg,
  onMediaLoad,
  onRetry,
  highlightQuery = "",
  isSearchHit = false,
}) {
  const mine = msg.from === "me";
  const attachments = Array.isArray(msg.attachments) ? msg.attachments : [];

  const isImageAtt = (a) => {
    const mime = String(a?.mime || "").toLowerCase();
    const url = String(a?.url || "").toLowerCase();
    const kind = String(a?.kind || "").toLowerCase();

    return (
      kind === "image" ||
      kind === "gif" || // ✅ gif url-only
      mime.startsWith("image/") ||
      /\.(png|jpe?g|webp|gif)(\?|$)/.test(url) // ✅ có query vẫn match
    );
  };

  const prettySize = (n) => {
    const bytes = Number(n || 0);
    if (!bytes || Number.isNaN(bytes)) return "";
    const mb = bytes / 1024 / 1024;
    if (mb >= 1) return `${mb.toFixed(2)} MB`;
    const kb = bytes / 1024;
    return `${kb.toFixed(0)} KB`;
  };

  const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const renderHighlightedText = (text) => {
    const q = String(highlightQuery || "").trim();
    if (!q) return text;

    const raw = String(text || "");
    const re = new RegExp(`(${escapeRegExp(q)})`, "ig");
    const parts = raw.split(re);

    const markClass = [
      "rounded px-0.5",
      mine ? "bg-white/20 text-white" : "bg-yellow-200",
    ].join(" ");

    return parts.map((p, i) =>
      i % 2 === 1 ? (
        <mark key={i} className={markClass}>
          {p}
        </mark>
      ) : (
        <span key={i}>{p}</span>
      )
    );
  };

  // shared image styles (NO CROP)
  const imgClass = [
    "mt-2 rounded-xl w-full h-auto",
    "max-h-[520px] object-contain", // <-- show full image, no crop
    "cursor-zoom-in",
    mine ? "bg-white/10" : "bg-zinc-100",
  ].join(" ");

  return (
    <div className={["flex", mine ? "justify-end" : "justify-start"].join(" ")}>
      {!mine ? (
        <img
          src={msg.avatar}
          alt={msg.name}
          className="object-cover mt-1 mr-3 rounded-full w-9 h-9"
        />
      ) : null}

      <div
        className={[
          "max-w-[70%] rounded-2xl px-4 py-3 ring-1",
          mine
            ? "bg-violet-600 text-white ring-violet-300"
            : "bg-white text-zinc-900 ring-zinc-200",
          isSearchHit ? "ring-2 ring-yellow-400 shadow-sm" : "",
        ].join(" ")}
      >
        {msg.text ? (
          <p className="text-sm leading-relaxed">
            {renderHighlightedText(msg.text)}
          </p>
        ) : null}

        {/* older field */}
        {msg.image ? (
          <a
            href={msg.image}
            target="_blank"
            rel="noreferrer"
            className="block"
          >
            <img
              src={msg.image}
              alt="attachment"
              className={imgClass}
              onLoad={() => onMediaLoad?.()}
              onError={() => onMediaLoad?.()}
            />
          </a>
        ) : null}

        {/* attachments */}
        {attachments.length ? (
          <div className="mt-2 space-y-2">
            {attachments.map((a, idx) => {
              const url = a?.url;
              if (!url) return null;

              if (isImageAtt(a)) {
                const url = a?.url;
                const src = a?.preview || url; // ✅ gif dùng preview nhẹ hơn

                return (
                  <img
                    key={`${url}-${idx}`}
                    src={src}
                    alt={a?.name || "media"}
                    className="max-w-[260px] rounded-2xl ring-1 ring-zinc-200"
                    loading="lazy"
                    onLoad={() => onMediaLoad?.()}
                    onError={() => onMediaLoad?.()}
                  />
                );
              }

              return (
                <a
                  key={`${url}-${idx}`}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className={[
                    "flex items-center gap-3 rounded-xl px-3 py-2 transition",
                    mine
                      ? "bg-white/10 hover:bg-white/15"
                      : "bg-zinc-50 hover:bg-zinc-100",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "grid h-9 w-9 place-items-center rounded-xl",
                      mine ? "bg-white/10" : "bg-white",
                    ].join(" ")}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M21.4 11.6 12.8 20.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 1 1 5.7 5.7l-9.2 9.2a2 2 0 1 1-2.8-2.8l8.6-8.6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>

                  <span className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {a?.name || "File"}
                    </div>
                    <div
                      className={[
                        "text-[11px]",
                        mine ? "text-white/70" : "text-zinc-500",
                      ].join(" ")}
                    >
                      {prettySize(a?.size)}
                    </div>
                  </span>
                </a>
              );
            })}
          </div>
        ) : null}

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
      </div>
    </div>
  );
}
