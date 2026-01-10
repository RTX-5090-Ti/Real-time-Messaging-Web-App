import { useEffect, useRef, useState, useCallback } from "react";
import { ChatAPI } from "../../api/chat.api.js";
import { avatarFromName, formatTime } from "../../utils/chatUi.js";

export function useChatHistory({
  meId,
  activeChatId,
  setChats, // optional (để clear unread)
  setMessagesByChatId,
  socket,
  joinedConvosRef, // Set()
}) {
  const [pagingByCid, setPagingByCid] = useState({});
  // { [cid]: { hasMore, nextBefore, loadingMore, loadingInit } }

  const mapToUi = useCallback(
    (m) => {
      const sender = m.sender || m.senderId || null;
      const senderId = sender?.id ? String(sender.id) : null;
      const senderName = sender?.name ?? "User";
      const createdAt = m.createdAt ?? new Date().toISOString();
      const attachments = Array.isArray(m.attachments) ? m.attachments : [];

      return {
        id: String(m.id ?? m._id),
        from: senderId === String(meId) ? "me" : "other",
        name: senderName,
        avatar: avatarFromName(senderName),
        text: m.text ?? "",
        attachments,
        time: formatTime(createdAt),
        createdAt,
      };
    },
    [meId]
  );

  // giữ paging 최신 để loadMore không bị stale closure
  const pagingRef = useRef({});
  useEffect(() => {
    pagingRef.current = pagingByCid;
  }, [pagingByCid]);

  // load first page when open chat
  useEffect(() => {
    const cid = activeChatId ? String(activeChatId) : "";
    if (!cid || !meId) return;

    (async () => {
      setPagingByCid((prev) => ({
        ...prev,
        [cid]: { ...(prev[cid] || {}), loadingInit: true, loadingMore: false },
      }));

      // ✅ first page
      const { data } = await ChatAPI.getMessages(cid, { limit: 30 });
      const ui = (data?.messages || []).map(mapToUi);

      setMessagesByChatId((prev) => ({ ...prev, [cid]: ui }));

      setPagingByCid((prev) => ({
        ...prev,
        [cid]: {
          hasMore: !!data?.hasMore,
          nextBefore: data?.nextBefore || (ui[0]?.createdAt ?? null),
          loadingInit: false,
          loadingMore: false,
        },
      }));

      // ✅ clear unread badge (optional)
      if (typeof setChats === "function") {
        setChats((prev) =>
          prev.map((c) => (c.id === cid ? { ...c, unread: 0 } : c))
        );
      }
    })().catch(() => {
      setPagingByCid((prev) => ({
        ...prev,
        [cid]: { ...(prev[cid] || {}), loadingInit: false },
      }));
    });
  }, [
    activeChatId,
    meId,
    mapToUi,
    setChats,
    setMessagesByChatId,
    socket,
    joinedConvosRef,
  ]);

  const loadMore = useCallback(async () => {
    const cid = activeChatId ? String(activeChatId) : "";
    if (!cid) return;

    const p = pagingRef.current[cid];
    if (!p?.hasMore || p?.loadingMore || !p?.nextBefore) return;

    setPagingByCid((prev) => ({
      ...prev,
      [cid]: { ...(prev[cid] || {}), loadingMore: true },
    }));

    try {
      const { data } = await ChatAPI.getMessages(cid, {
        limit: 30,
        before: p.nextBefore,
      });

      const older = (data?.messages || []).map(mapToUi);

      setMessagesByChatId((prev) => {
        const cur = Array.isArray(prev[cid]) ? prev[cid] : [];
        const seen = new Set(cur.map((x) => x.id));
        const mergedOlder = older.filter((x) => !seen.has(x.id));
        return { ...prev, [cid]: [...mergedOlder, ...cur] };
      });

      const nextBefore =
        data?.nextBefore || (older[0]?.createdAt ?? p.nextBefore);

      setPagingByCid((prev) => ({
        ...prev,
        [cid]: {
          ...(prev[cid] || {}),
          hasMore: !!data?.hasMore && older.length > 0,
          nextBefore,
          loadingMore: false,
        },
      }));
    } catch (e) {
      console.error("Upload failed:", e); // dùng đến e rồi thì hết lỗi
      setPagingByCid((prev) => ({
        ...prev,
        [cid]: { ...(prev[cid] || {}), loadingMore: false },
      }));
    }
  }, [activeChatId, mapToUi, setMessagesByChatId]);

  const cid = activeChatId ? String(activeChatId) : "";
  const curPaging = cid ? pagingByCid[cid] : null;

  return {
    hasMore: !!curPaging?.hasMore,
    loadingMore: !!curPaging?.loadingMore,
    loadMore,
  };
}
