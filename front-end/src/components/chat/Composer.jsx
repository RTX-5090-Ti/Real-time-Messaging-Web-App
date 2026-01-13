const prettySize = (bytes) => {
  const n = Number(bytes || 0);
  if (!n) return "";
  const mb = n / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  const kb = n / 1024;
  return `${kb.toFixed(0)} KB`;
};

export default function Composer({
  chat,
  // refs
  attachWrapRef,
  fileInputRef,

  replyDraft,
  onCancelReply,

  // state
  text,
  setText,
  pending,
  sending,

  attachOpen,
  setAttachOpen,

  gifOpen,
  setGifOpen,
  gifQuery,
  setGifQuery,
  gifLoading,
  gifError,
  gifItems,

  // actions
  startTyping,
  stopTyping,
  onPickAnyFile,
  addPendingGif,
  removePending,
  handleSend,

  canSend,
  onChooseSticker,
}) {
  return (
    <div className="p-4 bg-white border-t border-zinc-200">
      <div className="flex items-end gap-3">
        {/* Attach */}
        <div ref={attachWrapRef} className="relative">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={onPickAnyFile}
          />

          <button
            type="button"
            title="Attach"
            disabled={!chat || sending}
            aria-expanded={attachOpen || gifOpen}
            aria-haspopup="menu"
            onClick={() => {
              if (!chat || sending) return;
              setGifOpen(false);
              setAttachOpen((v) => !v);
            }}
            className={[
              "grid text-white transition rounded-full h-11 w-11 place-items-center active:scale-95",
              !chat || sending
                ? "bg-zinc-200 text-zinc-500 cursor-not-allowed"
                : "bg-violet-600 text-white hover:bg-violet-700 cursor-pointer",
            ].join(" ")}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              className={[
                "transition-transform duration-200 ease-out",
                attachOpen || gifOpen ? "rotate-45" : "rotate-0",
              ].join(" ")}
            >
              <path
                d="M12 5v14M5 12h14"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {/* Attach menu */}
          <div
            role="menu"
            className={[
              "absolute bottom-full left-0 mb-2 w-56 rounded-2xl border border-zinc-200 bg-white shadow-lg p-2",
              "origin-bottom-left transition-all duration-200 ease-out",
              attachOpen
                ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
                : "opacity-0 translate-y-1 scale-95 pointer-events-none",
            ].join(" ")}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center w-full gap-3 px-3 py-2 text-sm transition cursor-pointer group rounded-xl text-zinc-700 hover:bg-violet-50 hover:text-violet-700"
            >
              <span className="grid transition h-9 w-9 place-items-center rounded-xl bg-zinc-50 group-hover:bg-white">
                📎
              </span>
              <span className="font-medium">Choose file</span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setAttachOpen(false);
                onChooseSticker?.();
              }}
              className="flex items-center w-full gap-3 px-3 py-2 text-sm transition cursor-pointer group rounded-xl text-zinc-700 hover:bg-violet-50 hover:text-violet-700"
            >
              <span className="grid transition h-9 w-9 place-items-center rounded-xl bg-zinc-50 group-hover:bg-white">
                🙂
              </span>
              <span className="font-medium">Choose sticker</span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setAttachOpen(false);
                setGifOpen(true);
                setGifQuery("");
              }}
              className="flex items-center w-full gap-3 px-3 py-2 text-sm transition cursor-pointer group rounded-xl text-zinc-700 hover:bg-violet-50 hover:text-violet-700"
            >
              <span className="grid transition h-9 w-9 place-items-center rounded-xl bg-zinc-50 group-hover:bg-white">
                GIF
              </span>
              <span className="font-medium">Choose GIF</span>
            </button>
          </div>

          {/* GIF Picker Panel */}
          <div
            className={[
              "absolute bottom-full left-0 mb-2 w-[360px] rounded-2xl border border-zinc-200 bg-white shadow-lg overflow-hidden",
              "origin-bottom-left transition-all duration-200 ease-out",
              gifOpen
                ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
                : "opacity-0 translate-y-1 scale-95 pointer-events-none",
            ].join(" ")}
          >
            <div className="p-3 border-b border-zinc-200">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  {replyDraft ? (
                    <div className="flex items-center gap-2 px-3 py-2 mb-2 border rounded-xl border-violet-100 bg-violet-50">
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-semibold text-violet-700">
                          Replying to {replyDraft.name}
                        </div>
                        <div className="text-xs truncate text-violet-700/90">
                          {replyDraft.preview}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onCancelReply?.()}
                        className="grid w-8 h-8 rounded-lg place-items-center hover:bg-white/60"
                        title="Cancel reply"
                      >
                        ✕
                      </button>
                    </div>
                  ) : null}

                  <input
                    value={gifQuery}
                    onChange={(e) => setGifQuery(e.target.value)}
                    placeholder="Search GIFs…"
                    className="w-full px-3 py-2 text-sm border outline-none rounded-xl border-zinc-200 focus:border-violet-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setGifOpen(false)}
                  className="grid w-9 h-9 rounded-xl hover:bg-zinc-100 place-items-center"
                  title="Close"
                >
                  ✕
                </button>
              </div>

              {gifError ? (
                <div className="mt-2 text-xs text-rose-600">{gifError}</div>
              ) : null}
            </div>

            <div className="p-3 max-h-[360px] overflow-auto">
              {gifLoading ? (
                <div className="text-sm text-zinc-500">Loading…</div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {gifItems.map((g) => (
                    <button
                      key={g.gifId}
                      type="button"
                      onClick={() => {
                        addPendingGif(g);
                        setGifOpen(false);
                      }}
                      className="relative overflow-hidden rounded-xl bg-zinc-100 hover:ring-2 hover:ring-violet-400"
                      title="Select GIF"
                    >
                      <img
                        src={g.preview}
                        alt="gif"
                        className="object-cover w-full h-24"
                        loading="lazy"
                      />
                      <span className="absolute bottom-1 left-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/70 text-white">
                        GIF
                      </span>
                    </button>
                  ))}
                  {!gifItems.length ? (
                    <div className="col-span-3 text-sm text-zinc-500">
                      No results.
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Text + pending preview */}
        <div className="flex-1 px-4 py-3 bg-white border rounded-2xl border-zinc-200">
          {pending.length ? (
            <div className="flex gap-2 pt-3 pb-2 pr-1 pr-3 overflow-x-auto overflow-y-visible">
              {pending.map((p) => {
                const titleText =
                  p.kind === "gif" ? "GIF" : p?.file?.name || "Attachment";
                const thumbSrc = p.kind === "gif" ? p.previewUrl : p.previewUrl;

                return (
                  <div
                    key={p.id}
                    className="relative overflow-visible shrink-0"
                    title={titleText}
                  >
                    <button
                      type="button"
                      onClick={() => removePending(p.id)}
                      disabled={sending}
                      className={[
                        "absolute top-0 right-0 z-30 grid w-6 h-6 rounded-full",
                        "translate-x-1/2 -translate-y-1/2",
                        "bg-black/70 text-white place-items-center",
                        "hover:bg-black/80 transition cursor-pointer",
                        "shadow-sm ring-1 ring-white/60",
                      ].join(" ")}
                      title="Remove"
                    >
                      ✕
                    </button>

                    {p.kind === "image" || p.kind === "gif" ? (
                      <div className="relative">
                        <img
                          src={thumbSrc}
                          alt={titleText}
                          className="object-cover h-14 w-14 rounded-xl ring-1 ring-zinc-200"
                        />
                        {p.kind === "gif" ? (
                          <span className="absolute bottom-1 left-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/70 text-white">
                            GIF
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <div className="h-14 max-w-[260px] rounded-xl bg-zinc-50 ring-1 ring-zinc-200 px-3 flex items-center gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-medium truncate text-zinc-800">
                            {p.file.name}
                          </div>
                          <div className="flex items-center gap-2 text-[11px]">
                            <span className="text-zinc-500">
                              {prettySize(p.file.size)}
                            </span>
                            {p.status === "uploading" ? (
                              <span className="text-zinc-500">Uploading…</span>
                            ) : p.status === "uploaded" ? (
                              <span className="text-emerald-600">Uploaded</span>
                            ) : p.status === "error" ? (
                              <span className="text-rose-600">
                                Upload failed
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}

          {replyDraft ? (
            <div className="flex items-center justify-between gap-2 px-3 py-2 mb-2 text-sm bg-white border rounded-xl border-zinc-200">
              <div className="min-w-0">
                <div className="text-[12px] text-zinc-500">
                  Reply to{" "}
                  <span className="font-medium text-zinc-700">
                    {replyDraft.name}
                  </span>
                </div>
                <div className="truncate text-zinc-700">
                  {replyDraft.preview}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onCancelReply?.()}
                className="grid rounded-lg h-7 w-7 place-items-center hover:bg-zinc-100"
                title="Cancel reply"
              >
                ✕
              </button>
            </div>
          ) : null}

          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (chat) startTyping();
            }}
            onBlur={() => stopTyping()}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={chat ? "Write a message..." : "Select a chat first"}
            rows={1}
            disabled={!chat || sending}
            className="w-full text-sm bg-transparent outline-none resize-none text-zinc-900 placeholder:text-zinc-400 disabled:opacity-60"
          />
        </div>

        {/* Send */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className={[
            "grid h-11 w-11 rounded-xl place-items-center transition",
            !canSend
              ? "bg-zinc-200 text-zinc-500 cursor-not-allowed"
              : "bg-violet-600 text-white hover:bg-violet-700 cursor-pointer",
          ].join(" ")}
          title={sending ? "Sending..." : "Send"}
        >
          ➤
        </button>
      </div>
    </div>
  );
}
