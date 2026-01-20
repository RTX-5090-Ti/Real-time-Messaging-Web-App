import { useEffect, useRef, useState } from "react";
import EmojiPicker from "emoji-picker-react";

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

  stickerOpen,
  setStickerOpen,
  sendSticker,
}) {
  const STICKERS = [
    // 👇 thay bằng URL Cloudinary của mày
    "https://res.cloudinary.com/de93daa94/image/upload/v1768838652/row-1-column-4_uzqo6m.png",
    "https://res.cloudinary.com/de93daa94/image/upload/v1768838651/row-1-column-3_qmcyaq.png",
    "https://res.cloudinary.com/de93daa94/image/upload/v1768838651/row-1-column-3_qmcyaq.png",
    "https://res.cloudinary.com/de93daa94/image/upload/v1768838653/row-2-column-1_idjuhn.png",
    "https://res.cloudinary.com/de93daa94/image/upload/v1768838654/row-2-column-3_tlpzuw.png",
    "https://res.cloudinary.com/de93daa94/image/upload/v1768838493/row-1-column-1_neqfao.png",
    "https://res.cloudinary.com/de93daa94/image/upload/v1768838653/row-2-column-2_xttvzp.png",
    "https://res.cloudinary.com/de93daa94/image/upload/v1768838655/row-2-column-4_duscyt.png",
    "https://res.cloudinary.com/de93daa94/image/upload/v1768838656/row-3-column-1_slzdoh.png",
    "https://res.cloudinary.com/de93daa94/image/upload/v1768838657/row-3-column-2_ntucyl.png",
    "https://res.cloudinary.com/de93daa94/image/upload/v1768838657/row-3-column-2_ntucyl.png",
    "https://res.cloudinary.com/de93daa94/image/upload/v1768838658/row-3-column-4_vicupf.png",
    "https://res.cloudinary.com/de93daa94/image/upload/v1768838660/row-4-column-2_t46lxr.png",
    "https://res.cloudinary.com/de93daa94/image/upload/v1768838660/row-4-column-3_epnyvr.png",
    "https://res.cloudinary.com/de93daa94/image/upload/v1768838661/row-4-column-4_tqzeop.png",
    "https://res.cloudinary.com/de93daa94/image/upload/v1768838660/row-4-column-1_xtzfes.png",
  ];

  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiTheme, setEmojiTheme] = useState(() =>
    document.documentElement.classList.contains("dark") ? "dark" : "light",
  );

  useEffect(() => {
    const root = document.documentElement;
    const update = () =>
      setEmojiTheme(root.classList.contains("dark") ? "dark" : "light");

    update();
    const obs = new MutationObserver(update);
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });

    return () => obs.disconnect();
  }, []);

  const emojiBtnRef = useRef(null);
  const emojiBoxRef = useRef(null);
  const inputRef = useRef(null);

  const insertAtCursor = (emoji) => {
    const el = inputRef.current;

    if (!el) {
      setText((prev) => prev + emoji);
      if (chat) startTyping?.();
      return;
    }

    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;

    const next = text.slice(0, start) + emoji + text.slice(end);
    setText(next);
    if (chat) startTyping?.();

    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  };

  // click ngoài / ESC để đóng emoji picker
  useEffect(() => {
    if (!emojiOpen) return;

    const onMouseDown = (e) => {
      const t = e.target;

      if (emojiBoxRef.current?.contains(t)) return;
      if (emojiBtnRef.current?.contains(t)) return;

      setEmojiOpen(false);
    };

    const onKeyDown = (e) => {
      if (e.key === "Escape") setEmojiOpen(false);
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [emojiOpen]);

  return (
    <div className="p-3 bg-white border-t dark:bg-zinc-950 sm:p-4 border-zinc-200 dark:border-zinc-800">
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
              "absolute bottom-full left-0 mb-2 w-56 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg p-2",
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
              className="flex items-center w-full gap-3 px-3 py-2 text-sm transition cursor-pointer group rounded-xl text-zinc-700 dark:text-zinc-100 hover:bg-violet-50 hover:text-violet-700 dark:hover:bg-violet-500/10 dark:hover:text-violet-200"
            >
              <span className="grid transition h-9 w-9 place-items-center rounded-xl bg-zinc-50 dark:bg-zinc-800 group-hover:bg-white dark:group-hover:bg-zinc-700">
                📎
              </span>
              <span className="font-medium">Choose file</span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setAttachOpen(false);
                setGifOpen(false);
                setStickerOpen?.(true);
              }}
              className="flex items-center w-full gap-3 px-3 py-2 text-sm transition cursor-pointer group rounded-xl text-zinc-700 dark:text-zinc-100 hover:bg-violet-50 hover:text-violet-700 dark:hover:bg-violet-500/10 dark:hover:text-violet-200"
            >
              <span className="grid transition h-9 w-9 place-items-center rounded-xl bg-zinc-50 dark:bg-zinc-800 group-hover:bg-white dark:group-hover:bg-zinc-700">
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
              <span className="grid transition h-9 w-9 place-items-center rounded-xl bg-zinc-50 dark:bg-zinc-800 group-hover:bg-white dark:group-hover:bg-zinc-700">
                GIF
              </span>
              <span className="font-medium">Choose GIF</span>
            </button>
          </div>

          {/* GIF Picker Panel */}
          <div
            className={[
              "absolute bottom-full left-0 mb-2 w-[92vw] w-[360px] rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden",
              "origin-bottom-left transition-all duration-200 ease-out",
              gifOpen
                ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
                : "opacity-0 translate-y-1 scale-95 pointer-events-none",
            ].join(" ")}
          >
            <div className="p-3 border-b border-zinc-200 dark:border-zinc-700">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  {replyDraft ? (
                    <div className="flex items-center gap-2 px-3 py-2 mb-2 border rounded-xl border-violet-100 dark:border-violet-500/20 bg-violet-50 dark:bg-violet-500/10">
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
                    className="w-full px-3 py-2 text-sm bg-white border outline-none rounded-xl border-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-violet-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setGifOpen(false)}
                  className="grid w-9 h-9 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 place-items-center text-zinc-700 dark:text-zinc-100"
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
                      className="relative overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:ring-2 hover:ring-violet-400"
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

          {/* Sticker Picker Panel */}
          <div
            className={[
              "absolute bottom-full left-0 mb-2 w-[92vw] w-[320px] rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden",
              "origin-bottom-left transition-all duration-200 ease-out",
              stickerOpen
                ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
                : "opacity-0 translate-y-1 scale-95 pointer-events-none",
            ].join(" ")}
          >
            <div className="flex items-center justify-between p-3 border-b border-zinc-200 dark:border-zinc-700">
              <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                Stickers
              </div>

              <button
                type="button"
                onClick={() => setStickerOpen?.(false)}
                className="grid w-9 h-9 rounded-xl hover:bg-zinc-100 place-items-center"
                title="Close"
              >
                ✕
              </button>
            </div>

            <div className="p-3 max-h-[340px] overflow-auto">
              <div className="grid grid-cols-3 gap-2">
                {STICKERS.map((url, idx) => (
                  <button
                    key={`${url}-${idx}`}
                    type="button"
                    onClick={() => {
                      sendSticker?.(url); // ✅ gửi luôn
                      setStickerOpen?.(false);
                    }}
                    className="relative overflow-hidden rounded-xl bg-zinc-50 dark:bg-zinc-800 hover:ring-2 hover:ring-violet-400"
                    title="Send sticker"
                  >
                    <img
                      src={url}
                      alt="sticker"
                      className="object-contain w-full h-24"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Text + pending preview */}
        <div className="flex-1 px-4 py-3 bg-white border dark:bg-zinc-950 rounded-2xl border-zinc-200 dark:border-zinc-700">
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
                          className="object-cover h-14 w-14 rounded-xl ring-1 ring-zinc-200 dark:ring-zinc-700"
                        />
                        {p.kind === "gif" ? (
                          <span className="absolute bottom-1 left-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/70 text-white">
                            GIF
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <div className="h-14 max-w-[260px] rounded-xl bg-zinc-50 dark:bg-zinc-900 ring-1 ring-zinc-200 dark:ring-zinc-700 px-3 flex items-center gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-medium truncate text-zinc-800 dark:text-zinc-100">
                            {p.file.name}
                          </div>
                          <div className="flex items-center gap-2 text-[11px]">
                            <span className="text-zinc-500 dark:text-zinc-400">
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
            <div className="flex items-center justify-between gap-2 px-3 py-2 mb-2 text-sm bg-white border dark:bg-zinc-900 rounded-xl border-zinc-200 dark:border-zinc-700">
              <div className="min-w-0">
                <div className="text-[12px] text-zinc-500 dark:text-zinc-400">
                  Reply to{" "}
                  <span className="font-medium text-zinc-700 dark:text-zinc-200">
                    {replyDraft.name}
                  </span>
                </div>
                <div className="truncate text-zinc-700 dark:text-zinc-200">
                  {replyDraft.preview}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onCancelReply?.()}
                className="grid rounded-lg h-7 w-7 place-items-center hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-100"
                title="Cancel reply"
              >
                ✕
              </button>
            </div>
          ) : null}

          <div className="relative flex items-center justify-center gap-2">
            <textarea
              ref={inputRef}
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
              className="flex-1 min-w-0 text-sm bg-transparent outline-none resize-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 disabled:opacity-60"
            />

            {/* Emoji icon (UI only) */}
            {/* Emoji */}
            <button
              ref={emojiBtnRef}
              type="button"
              disabled={!chat || sending}
              title="Emoji"
              className={[
                "grid w-9 h-9 rounded-xl place-items-center transition active:scale-95",
                !chat || sending
                  ? "text-zinc-400 cursor-not-allowed"
                  : "text-violet-600 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-500/10 cursor-pointer",
              ].join(" ")}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!chat || sending) return;

                // đóng menu khác cho gọn UI
                setAttachOpen?.(false);
                setGifOpen?.(false);

                setEmojiOpen((v) => !v);
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <circle cx="9.2" cy="10.2" r="1.2" fill="currentColor" />
                <circle cx="14.8" cy="10.2" r="1.2" fill="currentColor" />
                <path
                  d="M8.2 14.2C9.4 15.6 10.7 16.3 12 16.3C13.3 16.3 14.6 15.6 15.8 14.2"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {/* Emoji Picker Popover */}
            {emojiOpen && (
              <div
                ref={emojiBoxRef}
                className={[
                  "absolute right-0 bottom-[calc(100%+10px)] z-[80]",
                  "rounded-2xl overflow-hidden",
                  "shadow-xl ring-1 ring-zinc-200 dark:ring-zinc-700 bg-white dark:bg-zinc-950",
                ].join(" ")}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <EmojiPicker
                  theme={emojiTheme}
                  lazyLoadEmojis
                  searchPlaceHolder="Search emoji…"
                  width={360}
                  height={420}
                  onEmojiClick={(emojiData) => {
                    insertAtCursor(emojiData.emoji);
                    // thích chọn xong auto đóng thì mở dòng này:
                    // setEmojiOpen(false);
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Send */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className={[
            "grid h-11 w-11 rounded-xl place-items-center transition",
            !canSend
              ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-300 cursor-not-allowed"
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
