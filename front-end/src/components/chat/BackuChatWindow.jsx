import { useMemo, useRef, useEffect, useState } from "react";
import { MessageBubble } from "./MessageBubble.jsx";
import TypingIndicator from "./TypingIndicator.jsx";
import { ChatAPI } from "../../api/chat.api.js";

function Icon({ children, tooltip, onClick, active }) {
  return (
    <div className="relative">
      <span className="inline-flex group">
        <button
          type="button"
          onClick={onClick}
          className={[
            "inline-flex items-center justify-center transition cursor-pointer h-9 w-9 rounded-xl",
            active ? "bg-violet-50 text-violet-700" : "hover:bg-zinc-100",
          ].join(" ")}
          aria-pressed={!!active}
          title={tooltip}
        >
          {children}
        </button>
      </span>
    </div>
  );
}

const isImageFile = (file) =>
  String(file?.type || "")
    .toLowerCase()
    .startsWith("image/");

const prettySize = (bytes) => {
  const n = Number(bytes || 0);
  if (!n) return "";
  const mb = n / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  const kb = n / 1024;
  return `${kb.toFixed(0)} KB`;
};

/**
 * Props:
 * - onSend(text) // text-only
 * - onSendMessage({ text, files, gifAttachments }) // text + images + URL-only gifs
 * - onChooseSticker()
 */
export default function ChatWindow({
  chat,
  messages,
  onSend,
  onSendMessage,
  onProfile,
  isInfoOpen,
  onToggleInfo,
  otherOnline = false,
  typingText = null,
  seenBy = [],
  onTypingStart,
  onTypingStop,
  onChooseSticker,
}) {
  const title = chat?.name ?? "Messages";
  const listRef = useRef(null);

  const [text, setText] = useState("");
  const canceledRawIdsRef = useRef(new Set());

  // typing debounce
  const typingRef = useRef(false);
  const typingTimerRef = useRef(null);

  // Attach menu
  const [attachOpen, setAttachOpen] = useState(false);
  const attachWrapRef = useRef(null);

  const fileInputRef = useRef(null);

  // ===== GIF Picker (GIPHY) =====
  const GIPHY_KEY = import.meta.env.VITE_GIPHY_KEY;
  const [gifOpen, setGifOpen] = useState(false);
  const [gifQuery, setGifQuery] = useState("");
  const [gifLoading, setGifLoading] = useState(false);
  const [gifError, setGifError] = useState("");
  const [gifItems, setGifItems] = useState([]);

  // pending item:
  // - image: { id, file, kind:"image", previewUrl:"blob:...", status, uploaded? }
  // - gif:   { id, kind:"gif", previewUrl:"https://..200w.gif", gif:{...} }
  // - file:  { id, file, kind:"file", status:"uploading|uploaded|error", uploaded? }
  const [pending, setPending] = useState([]);
  const [sending, setSending] = useState(false);

  const revokeIfNeeded = (item) => {
    // chỉ revoke object URL (blob:)
    if (item?.previewUrl && String(item.previewUrl).startsWith("blob:")) {
      URL.revokeObjectURL(item.previewUrl);
    }
  };

  const scrollToBottom = (smooth = false) => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
  };

  const clearPending = () => {
    setPending((prev) => {
      prev.forEach(revokeIfNeeded);
      return [];
    });
  };

  // upload raw file immediately
  const uploadRawNow = async (id, file) => {
    try {
      const { data } = await ChatAPI.uploadSingle(file);
      const uploaded = data?.file;

      // Nếu user đã bấm X trong lúc đang upload -> upload xong thì xoá ngay trên Cloudinary
      if (canceledRawIdsRef.current.has(id) && uploaded?.publicId) {
        try {
          await ChatAPI.deleteUploaded({
            publicId: uploaded.publicId,
            resourceType: uploaded.resourceType || "raw",
          });
        } catch {
          // ignore
        }
        return;
      }

      // bình thường: update trạng thái lên UI
      setPending((prev) =>
        prev.map((x) =>
          x.id === id
            ? {
                ...x,
                status: uploaded?.url ? "uploaded" : "error",
                uploaded: uploaded?.url
                  ? {
                      url: uploaded.url,
                      publicId: uploaded.publicId,
                      resourceType: uploaded.resourceType || "raw",
                    }
                  : null,
              }
            : x
        )
      );
    } catch (e) {
      console.error("Upload failed:", e);
      setPending((prev) =>
        prev.map((x) => (x.id === id ? { ...x, status: "error" } : x))
      );
    }
  };

  const addPendingFile = (file) => {
    const id =
      (globalThis.crypto?.randomUUID && crypto.randomUUID()) ||
      `${Date.now()}_${Math.random().toString(16).slice(2)}`;

    // NOTE: gif local cũng coi như image -> upload Cloudinary như bình thường
    const kind = isImageFile(file) ? "image" : "file";
    const previewUrl = kind === "file" ? "" : URL.createObjectURL(file);

    const item = {
      id,
      file,
      kind,
      previewUrl,
      status: kind === "file" ? "uploading" : "local",
      uploaded: null,
    };

    setPending((prev) => [...prev, item]);

    // raw upload ngay lập tức
    if (kind === "file") {
      uploadRawNow(id, file);
    }
  };

  const addPendingGif = (g) => {
    const id =
      (globalThis.crypto?.randomUUID && crypto.randomUUID()) ||
      `${Date.now()}_${Math.random().toString(16).slice(2)}`;

    const item = {
      id,
      kind: "gif",
      previewUrl: g.preview || g.url,
      gif: {
        kind: "gif",
        provider: "giphy",
        gifId: g.gifId,
        url: g.url,
        preview: g.preview,
        width: g.width,
        height: g.height,
        mp4: g.mp4 || "",
      },
    };

    setPending((prev) => [...prev, item]);
  };

  const removePending = async (id) => {
    // đánh dấu đã huỷ (để upload xong thì auto delete)
    canceledRawIdsRef.current.add(id);

    let removed = null;
    setPending((prev) => {
      removed = prev.find((x) => x.id === id) || null;
      if (removed) revokeIfNeeded(removed);
      return prev.filter((x) => x.id !== id);
    });

    // nếu nó đã upload xong rồi thì xoá ngay
    if (removed?.kind === "file" && removed?.uploaded?.publicId) {
      try {
        await ChatAPI.deleteUploaded({
          publicId: removed.uploaded.publicId,
          resourceType: removed.uploaded.resourceType || "raw",
        });
      } catch {
        // ignore
      }
    }
  };

  // close attach menu / gif picker on outside click / ESC
  useEffect(() => {
    if (!attachOpen && !gifOpen) return;

    const onDown = (e) => {
      if (!attachWrapRef.current) return;
      if (!attachWrapRef.current.contains(e.target)) {
        setAttachOpen(false);
        setGifOpen(false);
      }
    };

    const onKey = (e) => {
      if (e.key === "Escape") {
        setAttachOpen(false);
        setGifOpen(false);
      }
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [attachOpen, gifOpen]);

  const stopTyping = () => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    if (typingRef.current) {
      typingRef.current = false;
      onTypingStop?.();
    }
  };

  const startTyping = () => {
    if (!typingRef.current) {
      typingRef.current = true;
      onTypingStart?.();
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => stopTyping(), 900);
  };

  // reset when switching chat
  useEffect(() => {
    stopTyping();
    setText("");
    setAttachOpen(false);
    setGifOpen(false);
    setGifQuery("");
    setGifItems([]);
    setGifError("");
    clearPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat?.id]);

  // cleanup object URLs
  useEffect(() => {
    return () => {
      pending.forEach(revokeIfNeeded);
    };
  }, [pending]);

  // auto scroll
  useEffect(() => {
    scrollToBottom(false);
  }, [messages, typingText]);

  const subtitle = useMemo(() => {
    if (!chat) return null;
    return otherOnline ? "Online" : "Offline";
  }, [chat, otherOnline]);

  // Seen animation trigger
  const seenKey = useMemo(
    () => (seenBy || []).map((x) => x.id).join(","),
    [seenBy]
  );
  const [seenIn, setSeenIn] = useState(false);

  useEffect(() => {
    if (!seenKey) {
      setSeenIn(false);
      return;
    }
    setSeenIn(false);
    const raf = requestAnimationFrame(() => setSeenIn(true));
    return () => cancelAnimationFrame(raf);
  }, [seenKey, chat?.id]);

  const showTypingBubble = !!chat && !!typingText;

  const onPickAnyFile = (e) => {
    const list = Array.from(e.target.files || []);
    setAttachOpen(false);
    if (!chat || list.length === 0) return;
    list.forEach(addPendingFile);
    e.target.value = "";
  };

  // ===== GIPHY fetch (trending / search) =====
  useEffect(() => {
    if (!gifOpen) return;

    if (!GIPHY_KEY) {
      setGifError("Missing VITE_GIPHY_API_KEY in .env");
      setGifItems([]);
      return;
    }

    let cancelled = false;
    const q = gifQuery.trim();

    setGifLoading(true);
    setGifError("");

    const t = setTimeout(async () => {
      try {
        const endpoint = q
          ? `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(
              GIPHY_KEY
            )}&q=${encodeURIComponent(q)}&limit=24&rating=pg-13`
          : `https://api.giphy.com/v1/gifs/trending?api_key=${encodeURIComponent(
              GIPHY_KEY
            )}&limit=24&rating=pg-13`;

        const res = await fetch(endpoint);
        const json = await res.json();

        const data = Array.isArray(json?.data) ? json.data : [];
        const normalized = data
          .map((it) => {
            const id = it?.id;
            const original = it?.images?.original;
            const preview = it?.images?.fixed_width_small;
            const mp4 = it?.images?.original_mp4;

            const url = original?.url;
            const previewUrl = preview?.url || url;

            const w = Number(original?.width || preview?.width || 0);
            const h = Number(original?.height || preview?.height || 0);

            if (!id || !url) return null;

            return {
              gifId: id,
              url,
              preview: previewUrl,
              width: w || 0,
              height: h || 0,
              mp4: mp4?.mp4 || "",
            };
          })
          .filter(Boolean);

        if (!cancelled) setGifItems(normalized);
      } catch (e) {
        console.error("Upload failed:", e); // dùng đến e rồi thì hết lỗi
        if (!cancelled) setGifError("Failed to load GIFs");
      } finally {
        if (!cancelled) setGifLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [gifOpen, gifQuery, GIPHY_KEY]);

  const handleSend = async () => {
    if (!chat || sending) return;

    const v = text.trim();

    const imageItems = pending.filter((p) => p.kind === "image");
    const gifMetaItems = pending.filter((p) => p.kind === "gif");

    const sendFiles = imageItems.map((p) => p.file);
    const sendGifs = gifMetaItems.map((p) => p.gif);

    // if only raw files and no text -> do nothing
    if (!v && sendFiles.length === 0 && sendGifs.length === 0) return;

    // attachments path (images and/or GIF meta)
    if (sendFiles.length > 0 || sendGifs.length > 0) {
      if (typeof onSendMessage !== "function") {
        alert("onSendMessage is missing (cannot send attachments).");
        return;
      }
      try {
        setSending(true);
        await onSendMessage({
          text: v,
          files: sendFiles,
          gifAttachments: sendGifs,
        });

        // clear only sent items + keep raw demo files (so user can delete later)
        setText("");
        setPending((prev) => {
          prev
            .filter((x) => x.kind === "image" || x.kind === "gif")
            .forEach(revokeIfNeeded);
          return prev.filter((x) => x.kind === "file");
        });

        stopTyping();
      } finally {
        setSending(false);
      }
      return;
    }

    // text-only path
    onSend?.(v);
    setText("");
    stopTyping();
  };

  const hasSendable = pending.some(
    (p) => p.kind === "image" || p.kind === "gif"
  );
  const canSend = !!chat && !sending && (text.trim() || hasSendable);

  return (
    <main className="flex flex-col flex-1 min-w-0 bg-zinc-50">
      {/* Header */}
      <div className="flex items-center justify-between h-16 px-5 bg-white border-b border-zinc-200">
        <div className="min-w-0">
          <p className="font-semibold truncate text-zinc-900">{title}</p>
          {chat ? <p className="text-xs text-zinc-500">{subtitle}</p> : null}
        </div>

        <div className="flex items-center gap-2">
          <Icon tooltip="Open profile" onClick={onProfile}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm-8 9a8 8 0 0 1 16 0"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </Icon>

          <Icon
            tooltip="Conversation info"
            onClick={onToggleInfo}
            active={isInfoOpen}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 17v-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M12 7h.01"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <path
                d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
          </Icon>
        </div>
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 p-6 space-y-5 overflow-y-auto">
        {chat ? (
          <>
            {messages.map((m, idx) => {
              const isLast = idx === messages.length - 1;
              const showSeen =
                isLast && m.from === "me" && (seenBy?.length ?? 0) > 0;

              return (
                <div key={m.id} className="space-y-1">
                  <MessageBubble
                    msg={m}
                    onMediaLoad={() => scrollToBottom(false)}
                  />

                  {/* Seen-by avatar */}
                  {showSeen ? (
                    <div className="flex justify-end mt-[10px]">
                      <div
                        className={[
                          "flex items-center gap-2 pr-2",
                          "transition-all duration-200 ease-out",
                          seenIn
                            ? "opacity-100 translate-y-0 scale-100"
                            : "opacity-0 translate-y-1 scale-90",
                        ].join(" ")}
                      >
                        <div className="flex -space-x-2">
                          {seenBy.slice(0, 3).map((u) => (
                            <img
                              key={u.id}
                              src={u.avatar}
                              alt={u.name}
                              title={`Seen by ${u.name}`}
                              className="object-cover w-5 h-5 rounded-full shadow-sm ring-2 ring-white"
                            />
                          ))}
                          {seenBy.length > 3 ? (
                            <span className="grid w-5 h-5 text-[10px] font-semibold bg-white rounded-full ring-2 ring-white shadow-sm place-items-center text-zinc-600">
                              +{seenBy.length - 3}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}

            <TypingIndicator
              show={showTypingBubble}
              avatar={chat.avatar}
              name={chat.name}
            />
          </>
        ) : (
          <div className="grid h-full place-items-center text-zinc-500">
            Select a chat to start
          </div>
        )}
      </div>

      {/* Input */}
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

            {/* menu */}
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
              {/* Choose file */}
              <button
                type="button"
                role="menuitem"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center w-full gap-3 px-3 py-2 text-sm transition cursor-pointer group rounded-xl text-zinc-700 hover:bg-violet-50 hover:text-violet-700"
              >
                <span className="grid transition h-9 w-9 place-items-center rounded-xl bg-zinc-50 group-hover:bg-white">
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
                <span className="font-medium">Choose file</span>
              </button>

              {/* Choose sticker */}
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
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <path
                      d="M8.5 10.5h.01M15.5 10.5h.01"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    <path
                      d="M8.5 14.5c1 1.5 2.2 2.2 3.5 2.2s2.5-.7 3.5-2.2"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                <span className="font-medium">Choose sticker</span>
              </button>

              {/* Choose GIF (open picker) */}
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
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <rect
                      x="4"
                      y="6"
                      width="16"
                      height="12"
                      rx="3"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <path
                      d="M8 15v-6h3"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M8 12h2"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M13 9v6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M16 9h3"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M16 12h2.5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
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
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M18 6 6 18M6 6l12 12"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>

                {!GIPHY_KEY ? (
                  <div className="mt-2 text-xs text-rose-600">
                    Missing <b>VITE_GIPHY_API_KEY</b> in .env
                  </div>
                ) : null}
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
                    {!gifItems.length && GIPHY_KEY ? (
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
                  const thumbSrc =
                    p.kind === "gif" ? p.previewUrl : p.previewUrl;

                  return (
                    <div
                      key={p.id}
                      className="relative overflow-visible shrink-0"
                      title={titleText}
                    >
                      {/* X button (inside) */}
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
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M18 6 6 18M6 6l12 12"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                        </svg>
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
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            className="shrink-0"
                          >
                            <path
                              d="M21.4 11.6 12.8 20.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 1 1 5.7 5.7l-9.2 9.2a2 2 0 1 1-2.8-2.8l8.6-8.6"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>

                          <div className="min-w-0">
                            <div className="text-xs font-medium truncate text-zinc-800">
                              {p.file.name}
                            </div>
                            <div className="flex items-center gap-2 text-[11px]">
                              <span className="text-zinc-500">
                                {prettySize(p.file.size)}
                              </span>
                              {p.status === "uploading" ? (
                                <span className="text-zinc-500">
                                  Uploading…
                                </span>
                              ) : p.status === "uploaded" ? (
                                <span className="text-emerald-600">
                                  Uploaded
                                </span>
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M22 2 11 13"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M22 2 15 22l-4-9-9-4 20-7Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </main>
  );
}
