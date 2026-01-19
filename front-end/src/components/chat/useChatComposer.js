import { useEffect, useMemo, useRef, useState } from "react";
import { ChatAPI } from "../../api/chat.api.js";

const isImageFile = (file) =>
  String(file?.type || "")
    .toLowerCase()
    .startsWith("image/");

const makeId = () =>
  (globalThis.crypto?.randomUUID && crypto.randomUUID()) ||
  `${Date.now()}_${Math.random().toString(16).slice(2)}`;

export function useChatComposer({
  chat,
  onSend,
  onSendMessage,
  onTypingStart,
  onTypingStop,
}) {
  const GIPHY_KEY = import.meta.env.VITE_GIPHY_KEY;

  const attachWrapRef = useRef(null);
  const fileInputRef = useRef(null);

  const [text, setText] = useState("");

  // typing debounce
  const typingRef = useRef(false);
  const typingTimerRef = useRef(null);
  const prevChatIdRef = useRef(null);

  // ✅ prevent "stuck typing" when switching chats
  useEffect(() => {
    const nextCid = chat?.id ? String(chat.id) : null;
    const prevCid = prevChatIdRef.current;

    // switching from prev -> next: force stop typing for prev
    if (prevCid && prevCid !== nextCid) {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
      if (typingRef.current) typingRef.current = false;
      onTypingStop?.(String(prevCid));
    }

    prevChatIdRef.current = nextCid;
  }, [chat?.id]);

  // ✅ on unmount: stop typing for current chat
  useEffect(() => {
    return () => {
      const cur = prevChatIdRef.current;
      if (cur) onTypingStop?.(String(cur));
    };
  }, []);
  // menu states
  const [attachOpen, setAttachOpen] = useState(false);

  // GIF picker states
  const [gifOpen, setGifOpen] = useState(false);
  const [gifQuery, setGifQuery] = useState("");
  const [gifLoading, setGifLoading] = useState(false);
  const [gifError, setGifError] = useState("");
  const [gifItems, setGifItems] = useState([]);

  // ✅ Sticker picker state
  const [stickerOpen, setStickerOpen] = useState(false);

  // pending item:
  // - image: { id, file, kind:"image", previewUrl:"blob:...", status:"local" }
  // - gif:   { id, kind:"gif", previewUrl:"https://..200w.gif", gif:{...} }
  // - file:  { id, file, kind:"file", status:"uploading|uploaded|error", uploaded? }
  const [pending, setPending] = useState([]);
  const pendingRef = useRef([]);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  const [sending, setSending] = useState(false);

  const canceledRawIdsRef = useRef(new Set());

  const revokeIfNeeded = (item) => {
    if (item?.previewUrl && String(item.previewUrl).startsWith("blob:")) {
      URL.revokeObjectURL(item.previewUrl);
    }
  };

  const clearPending = () => {
    setPending((prev) => {
      prev.forEach(revokeIfNeeded);
      return [];
    });
  };

  const stopTyping = () => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    if (typingRef.current) {
      typingRef.current = false;
      const cid = chat?.id ? String(chat.id) : null;
      if (cid) onTypingStop?.(cid);
    }
  };

  const startTyping = () => {
    if (!typingRef.current) {
      typingRef.current = true;
      const cid = chat?.id ? String(chat.id) : null;
      if (cid) onTypingStart?.(cid);
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => stopTyping(), 900); // thòi gian typing
  };

  // close menus on outside click / ESC
  useEffect(() => {
    if (!attachOpen && !gifOpen && !stickerOpen) return;

    const onDown = (e) => {
      if (!attachWrapRef.current) return;
      if (!attachWrapRef.current.contains(e.target)) {
        setAttachOpen(false);
        setGifOpen(false);
        setStickerOpen(false);
      }
    };

    const onKey = (e) => {
      if (e.key === "Escape") {
        setAttachOpen(false);
        setGifOpen(false);
        setStickerOpen(false);
      }
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [attachOpen, gifOpen, stickerOpen]);

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

  // cleanup on unmount (revoke blob URLs)
  useEffect(() => {
    return () => {
      pendingRef.current.forEach(revokeIfNeeded);
    };
  }, []);

  // upload raw file immediately
  const uploadRawNow = async (id, file) => {
    try {
      const { data } = await ChatAPI.uploadSingle(file);
      const uploaded = data?.file;

      // if user removed while uploading => delete cloudinary after done
      if (canceledRawIdsRef.current.has(id) && uploaded?.publicId) {
        try {
          await ChatAPI.deleteUploaded({
            publicId: uploaded.publicId,
            resourceType: uploaded.resourceType || "raw",
          });
        } catch (e) {
          // ignore
          console.error("[deleteUploaded] failed:", e?.response?.data || e);
        }
        return;
      }

      setPending((prev) =>
        prev.map((x) =>
          x.id === id
            ? {
                ...x,
                status: uploaded?.url ? "uploaded" : "error",
                uploaded: uploaded?.url
                  ? {
                      kind: uploaded.kind || "file", // ✅ QUAN TRỌNG
                      url: uploaded.url,
                      name: uploaded.name || file.name || "", // ✅ để UI hiện tên
                      mime: uploaded.mime || file.type || "",
                      size: uploaded.size || file.size || 0,
                      publicId: uploaded.publicId,
                      resourceType: uploaded.resourceType || "raw",
                    }
                  : null,
              }
            : x,
        ),
      );
    } catch (e) {
      console.error("Upload failed:", e);
      setPending((prev) =>
        prev.map((x) => (x.id === id ? { ...x, status: "error" } : x)),
      );
    }
  };

  const addPendingFile = (file) => {
    const id = makeId();
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

    // raw upload now
    if (kind === "file") uploadRawNow(id, file);
  };

  const addPendingGif = (g) => {
    const id = makeId();

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
    canceledRawIdsRef.current.add(id);

    // ✅ lấy item trước khi setState (ổn định 100%)
    const removed = pendingRef.current.find((x) => x.id === id) || null;

    // remove khỏi UI
    setPending((prev) => prev.filter((x) => x.id !== id));
    if (removed) revokeIfNeeded(removed);

    // ✅ nếu đã upload xong thì xoá cloud ngay
    if (removed?.uploaded?.publicId) {
      try {
        await ChatAPI.deleteUploaded({
          publicId: removed.uploaded.publicId,
          resourceType: removed.uploaded.resourceType || "raw",
        });
      } catch (e) {
        console.error("[deleteUploaded] failed:", e?.response?.data || e);
      }
    }
  };

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
      setGifError("Missing VITE_GIPHY_KEY in .env");
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
              GIPHY_KEY,
            )}&q=${encodeURIComponent(q)}&limit=24&rating=pg-13`
          : `https://api.giphy.com/v1/gifs/trending?api_key=${encodeURIComponent(
              GIPHY_KEY,
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

  const hasSendable = useMemo(
    () =>
      pending.some(
        (p) =>
          p.kind === "image" ||
          p.kind === "gif" ||
          (p.kind === "file" && p.status === "uploaded" && p.uploaded?.url),
      ),
    [pending],
  );

  const canSend = useMemo(() => {
    if (!chat || sending) return false;
    return !!text.trim() || hasSendable;
  }, [chat, sending, text, hasSendable]);

  const handleSend = async () => {
    if (!chat || sending) return;

    const v = text.trim();
    const imageItems = pending.filter((p) => p.kind === "image");
    const gifMetaItems = pending.filter((p) => p.kind === "gif");
    const fileItems = pending.filter(
      (p) => p.kind === "file" && p.status === "uploaded" && p.uploaded?.url,
    );

    const sendFiles = imageItems.map((p) => p.file); // ảnh local -> onSendMessage sẽ upload
    const sendGifs = gifMetaItems.map((p) => p.gif); // gif url-only
    const rawAttachments = fileItems.map((p) => p.uploaded); // ✅ file raw đã upload sẵn

    if (
      !v &&
      sendFiles.length === 0 &&
      sendGifs.length === 0 &&
      rawAttachments.length === 0
    )
      return;

    if (
      sendFiles.length > 0 ||
      sendGifs.length > 0 ||
      rawAttachments.length > 0
    ) {
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
          rawAttachments,
        });

        setText("");

        // clear sent image+gif, keep raw file items
        setPending((prev) => {
          prev.forEach(revokeIfNeeded);
          return [];
        });

        stopTyping();
      } finally {
        setSending(false);
      }
      return;
    }

    // text-only
    onSend?.(v);
    setText("");
    stopTyping();
  };

  const sendSticker = (url) => {
    const u = String(url || "").trim();
    if (!chat || !u) return;

    if (typeof onSendMessage !== "function") {
      alert("onSendMessage is missing (cannot send sticker).");
      return;
    }

    // đóng panel luôn cho đã
    setStickerOpen(false);
    setAttachOpen(false);
    setGifOpen(false);

    // sticker là URL-only, dùng rawAttachments luôn (backend mày support kind=sticker rồi)
    onSendMessage({
      text: "",
      files: [],
      gifAttachments: [],
      rawAttachments: [
        {
          kind: "sticker",
          url: u,
          name: "sticker",
          mime: "image/png",
          size: 0,
        },
      ],
    });
  };

  return {
    // refs
    attachWrapRef,
    fileInputRef,

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
  };
}
