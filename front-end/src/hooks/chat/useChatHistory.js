import { useEffect, useRef, useState, useCallback } from "react";
import { ChatAPI } from "../../api/chat.api.js";
import { avatarFromName, formatTime } from "../../utils/chatUi.js";
import { formatSystemText } from "../../utils/systemText.js";

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
      const senderAvatarUrl = sender?.avatarUrl || null;
      const createdAt = m.createdAt ?? new Date().toISOString();
      const attachments = Array.isArray(m.attachments) ? m.attachments : [];

      const kind = m.kind || "user";

      if (kind === "system") {
        const createdAt = m.createdAt ?? new Date().toISOString();
        return {
          id: String(m.id ?? m._id),
          kind: "system",
          from: "system",
          system: m.system || null,
          text: formatSystemText(m.system, m.text ?? "", meId),
          createdAt,
          time: formatTime(createdAt),
        };
      }

      return {
        id: String(m.id ?? m._id),
        from: senderId === String(meId) ? "me" : "other",
        senderId,
        name: senderName,
        avatarUrl: senderAvatarUrl,
        avatar: senderAvatarUrl || avatarFromName(senderName),
        text: m.text ?? "",
        attachments,
        time: formatTime(createdAt),
        createdAt,
        replyTo: m.replyTo
          ? {
              id: String(m.replyTo.id ?? m.replyTo._id),
              text: m.replyTo.text ?? "",
              attachments: Array.isArray(m.replyTo.attachments)
                ? m.replyTo.attachments
                : [],
              sender: m.replyTo.sender || m.replyTo.senderId || null,
            }
          : null,

        reactions: Array.isArray(m.reactions)
          ? m.reactions.map((r) => ({
              userId: String(r.userId?.id ?? r.userId?._id ?? r.userId),
              emoji: r.emoji,
            }))
          : [],
        pinned: !!m.pinned,
        pinnedAt: m.pinnedAt ?? null,
        pinnedBy: m.pinnedBy ?? null,

        editedAt: m.editedAt ?? null,
        isRecalled: !!m.isRecalled,
        recalledAt: m.recalledAt ?? null,
        recalledBy: m.recalledBy ?? null,
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
