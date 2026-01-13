import { useEffect, useRef, useState } from "react";
import { socket } from "../../socket/socket.js";
import { bumpChat } from "../../utils/chat/chatPageHelpers.js";
import { avatarFromName, formatTime } from "../../utils/chatUi.js";

export function useChatSocket({
  meId,
  setChats,
  setMessagesByChatId,
  setOnlineIds,
  activeChatIdRef,
  onNotificationNew,
  reloadConversations,
}) {
  const [typingByConvo, setTypingByConvo] = useState({});
  const [lastReadByConvo, setLastReadByConvo] = useState({});

  const processedMsgIdsRef = useRef(new Set());

  const previewTextFromAttachments = (attachments) => {
    if (!Array.isArray(attachments) || attachments.length === 0) return "";
    const a = attachments[0] || {};
    const mime = String(a.mime || "").toLowerCase();
    const name = a.name || "";
    if (
      mime === "image/gif" ||
      String(a.url || "")
        .toLowerCase()
        .endsWith(".gif")
    )
      return "Sent a GIF";
    const isImage = a.kind === "image" || mime.startsWith("image/");
    if (isImage) return "Sent a photo";
    return name ? `Sent a file: ${name}` : "Sent a file";
  };

  useEffect(() => {
    if (!meId) return;

    const onNewMessage = async (payload) => {
      const { conversationId } = payload || {};
      if (!conversationId) return;

      const serverMsgId = payload?.id ?? payload?._id;
      if (!serverMsgId) return;

      const msgKey = `${String(conversationId)}:${String(serverMsgId)}`;
      if (processedMsgIdsRef.current.has(msgKey)) return;
      processedMsgIdsRef.current.add(msgKey);
      if (processedMsgIdsRef.current.size > 2000)
        processedMsgIdsRef.current.clear();

      const sender = payload.sender || payload.senderId || null;
      const senderId = sender?.id ? String(sender.id) : null;
      const senderName = sender?.name ?? "User";
      const createdAt = payload.createdAt ?? new Date().toISOString();

      const attachments = Array.isArray(payload.attachments)
        ? payload.attachments
        : [];

      const uiMsg = {
        id: String(payload.id ?? payload._id),
        from: senderId === String(meId) ? "me" : "other",
        name: senderName,
        avatar: avatarFromName(senderName),
        text: payload.text ?? "",
        attachments,
        time: formatTime(createdAt),
        createdAt,
        replyTo: payload.replyTo || null,
        reactions: Array.isArray(payload.reactions) ? payload.reactions : [],
      };

      const cid = String(conversationId);
      const incomingClientId = payload?.clientId
        ? String(payload.clientId)
        : null;

      setMessagesByChatId((prev) => {
        const list = prev[cid] ?? [];

        // ✅ nếu đã có message thật (server id) thì thôi
        if (list.some((m) => m.id === uiMsg.id)) return prev;

        // ✅ replace optimistic nếu match clientId
        if (incomingClientId) {
          const tmpId = `tmp:${incomingClientId}`;
          const idx = list.findIndex(
            (m) => m.id === tmpId || m.clientId === incomingClientId
          );
          if (idx !== -1) {
            // revoke blob urls (nếu có)
            const old = list[idx];
            (old?._blobUrls || []).forEach((u) => {
              try {
                URL.revokeObjectURL(u);
              } catch {
                // Ignore error (best effort logout)
              }
            });

            const next = [...list];
            next[idx] = {
              ...uiMsg,
              clientId: incomingClientId,
              status: undefined,
              errorMsg: "",
              __retryPayload: undefined,
            };
            return { ...prev, [cid]: next };
          }
        }

        // fallback: append
        return { ...prev, [cid]: [...list, { ...uiMsg, pending: false }] };
      });

      const lastPreview = uiMsg.text?.trim()
        ? uiMsg.text
        : previewTextFromAttachments(attachments);

      setChats((prev) => {
        const cid = String(conversationId);

        if (!prev.some((c) => String(c.id) === cid)) {
          if (typeof reloadConversations === "function") {
            reloadConversations(String(meId)).catch(() => {});
          }
          return prev;
        }

        const isActive = cid === String(activeChatIdRef.current);
        const isFromMe = senderId === String(meId);
        const shouldIncUnread = !isActive && !isFromMe;

        return bumpChat(prev, cid, (c) => ({
          ...c,
          lastMessage: lastPreview,
          time: uiMsg.time,
          unread: shouldIncUnread
            ? Number(c.unread || 0) + 1
            : Number(c.unread || 0),
        }));
      });
    };

    const onPresenceState = (payload) => {
      const ids = payload?.onlineUserIds ?? [];
      if (!Array.isArray(ids)) return;
      setOnlineIds(ids.map(String));
    };

    const onPresenceUpdate = ({ userId, online }) => {
      const uid = String(userId);
      setOnlineIds((prev) => {
        const set = new Set((prev || []).map(String));
        if (online) set.add(uid);
        else set.delete(uid);
        return Array.from(set);
      });
    };

    const onTypingUpdate = ({ conversationId, userId, name, typing }) => {
      if (!conversationId || !userId) return;
      if (String(userId) === String(meId)) return;
      const cid = String(conversationId);
      const uid = String(userId);

      setTypingByConvo((prev) => {
        const next = { ...prev };
        const cur = { ...(next[cid] || {}) };
        if (typing) cur[uid] = name || "User";
        else delete cur[uid];

        if (Object.keys(cur).length === 0) delete next[cid];
        else next[cid] = cur;
        return next;
      });
    };

    const onConversationRead = ({ conversationId, userId, at }) => {
      if (!conversationId || !userId || !at) return;
      const cid = String(conversationId);
      const uid = String(userId);

      setLastReadByConvo((prev) => {
        const cur = prev[cid] || {};
        const prevAt = cur[uid] ? new Date(cur[uid]).getTime() : 0;
        const nextAt = new Date(at).getTime();
        if (nextAt <= prevAt) return prev;

        return {
          ...prev,
          [cid]: { ...cur, [uid]: at },
        };
      });
    };

    const onConnect = () => {
      const cid = activeChatIdRef.current;
      if (cid) {
        socket.emit("conversation:join", String(cid));
        // socket.emit("conversation:read", {
        //   conversationId: String(cid),
        //   at: new Date().toISOString(),
        // });
      }
    };

    const onMessageReaction = (payload = {}) => {
      const cid = String(payload.conversationId || "");
      const mid = String(payload.messageId || "");
      if (!cid || !mid) return;

      const reactions = Array.isArray(payload.reactions)
        ? payload.reactions
        : [];

      setMessagesByChatId((prev) => {
        const list = prev[cid] ?? [];
        const idx = list.findIndex((m) => String(m.id) === mid);
        if (idx === -1) return prev;

        const next = [...list];
        next[idx] = { ...next[idx], reactions };
        return { ...prev, [cid]: next };
      });
    };

    const onMessageEdited = (payload = {}) => {
      const cid = String(payload.conversationId || "");
      const mid = String(payload.messageId || "");
      if (!cid || !mid) return;

      setMessagesByChatId((prev) => {
        const list = prev[cid] ?? [];
        const idx = list.findIndex((m) => String(m.id) === mid);
        if (idx === -1) return prev;

        const next = [...list];
        next[idx] = {
          ...next[idx],
          text: payload.text ?? next[idx].text,
          editedAt: payload.editedAt,
        };
        return { ...prev, [cid]: next };
      });
    };

    const onMessageRecalled = (payload = {}) => {
      const cid = String(payload.conversationId || "");
      const mid = String(payload.messageId || "");
      if (!cid || !mid) return;

      setMessagesByChatId((prev) => {
        const list = prev[cid] ?? [];
        const idx = list.findIndex((m) => String(m.id) === mid);
        if (idx === -1) return prev;

        const next = [...list];
        next[idx] = {
          ...next[idx],
          text: payload.text ?? "Đã thu hồi tin nhắn",
          attachments: Array.isArray(payload.attachments)
            ? payload.attachments
            : [],
          reactions: Array.isArray(payload.reactions) ? payload.reactions : [],
          isRecalled: true,
          recalledAt: payload.recalledAt,
        };
        return { ...prev, [cid]: next };
      });
    };

    const onMessagePinned = (payload = {}) => {
      const cid = String(payload.conversationId || "");
      const mid = String(payload.messageId || "");
      if (!cid || !mid) return;

      setMessagesByChatId((prev) => {
        const list = prev[cid] ?? [];
        const idx = list.findIndex((m) => String(m.id) === mid);
        if (idx === -1) return prev;

        const next = [...list];
        next[idx] = {
          ...next[idx],
          pinned: !!payload.pinned,
          pinnedAt: payload.pinnedAt,
          pinnedBy: payload.pinnedBy,
        };
        return { ...prev, [cid]: next };
      });
    };

    const onNotification = (payload) => {
      if (typeof onNotificationNew === "function") onNotificationNew(payload);
    };

    socket.on("connect", onConnect);
    socket.on("message:new", onNewMessage);
    socket.on("presence:state", onPresenceState);

    socket.on("presence:update", onPresenceUpdate);
    socket.on("typing:update", onTypingUpdate);
    socket.on("conversation:read", onConversationRead);
    socket.on("notification:new", onNotification);

    socket.on("message:reaction", onMessageReaction);

    socket.on("message:edited", onMessageEdited);
    socket.on("message:recalled", onMessageRecalled);
    socket.on("message:pinned", onMessagePinned);

    if (!socket.connected) socket.connect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("message:new", onNewMessage);
      socket.off("presence:state", onPresenceState);
      socket.off("presence:update", onPresenceUpdate);
      socket.off("typing:update", onTypingUpdate);
      socket.off("conversation:read", onConversationRead);
      socket.off("notification:new", onNotification);
      socket.off("message:reaction", onMessageReaction);

      socket.off("message:edited", onMessageEdited);
      socket.off("message:recalled", onMessageRecalled);
      socket.off("message:pinned", onMessagePinned);
    };
  }, [
    meId,
    setChats,
    setMessagesByChatId,
    setOnlineIds,
    activeChatIdRef,
    onNotificationNew,
    reloadConversations,
  ]);

  return { typingByConvo, lastReadByConvo };
}
