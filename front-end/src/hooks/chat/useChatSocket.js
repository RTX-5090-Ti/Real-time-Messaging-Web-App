import { mapMessage, mergeMessages } from "../../utils/chat/messageState.js";
import { useEffect, useRef, useState } from "react";
import { socket } from "../../socket/socket.js";
import { bumpChat } from "../../utils/chat/chatPageHelpers.js";
import { avatarFromName, formatTime } from "../../utils/chatUi.js";
import { formatSystemText } from "../../utils/systemText.js";

export function useChatSocket({
  meId,
  setChats,
  setMe,
  setFriends,
  setMessagesByChatId,
  setOnlineIds,
  activeChatIdRef,
  onNotificationNew,
  reloadConversations,
}) {
  const [typingByConvo, setTypingByConvo] = useState({});
  const [lastReadByConvo, setLastReadByConvo] = useState({});

  const processedMsgIdsRef = useRef(new Set());

  const onNotificationNewRef = useRef(onNotificationNew);
  useEffect(() => {
    onNotificationNewRef.current = onNotificationNew;
  }, [onNotificationNew]);

  const reloadConversationsRef = useRef(reloadConversations);
  useEffect(() => {
    reloadConversationsRef.current = reloadConversations;
  }, [reloadConversations]);

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

      const kind = payload?.kind || "user";
      if (kind === "system") {
        if (!conversationId) return;

        const createdAt = payload.createdAt ?? new Date().toISOString();
        const cid = String(conversationId);
        const sys = payload.system || null;

        const uiSys = {
          id: String(payload.id ?? payload._id),
          kind: "system",
          from: "system",
          system: sys,
          text: formatSystemText(sys, payload.text ?? "", meId),
          createdAt,
          time: formatTime(createdAt),
        };

        setMessagesByChatId((prev) => {
          const list = prev[cid] ?? [];
          if (list.some((m) => m.id === uiSys.id)) return prev;
          return { ...prev, [cid]: [...list, uiSys] };
        });

        setChats((prev) =>
          bumpChat(prev, cid, (c) => ({
            ...c,
            lastMessage: uiSys.text || "Message",
            time: uiSys.time,
          })),
        );

        return; // ✅ system xong là dừng
      }

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
      const attachments = Array.isArray(payload.attachments)
        ? payload.attachments
        : [];

      const uiMsg = mapMessage(payload, meId);
      const cid = String(conversationId);
      setMessagesByChatId(prev => ({ ...prev, [cid]: mergeMessages(prev[cid] || [], [uiMsg]) }));

      if (payload.replay) {
        reloadConversationsRef.current?.(String(meId)).catch(() => {});
        return;
      }
      const basePreview = uiMsg.text?.trim()
        ? uiMsg.text
        : previewTextFromAttachments(attachments);

      setChats((prev) => {
        const cid = String(conversationId);

        if (!prev.some((c) => String(c.id) === cid)) {
          const fn = reloadConversationsRef.current;
          if (typeof fn === "function") fn(String(meId)).catch(() => {});

          return prev;
        }

        const isFromMe = senderId === String(meId);
        const shouldIncUnread = !isFromMe;

        return bumpChat(prev, cid, (c) => {
          const isGroup = String(c.type || "direct") === "group";
          const showPreview =
            isGroup && senderName
              ? `${senderName}: ${basePreview || "Message"}`
              : basePreview || "Message";

          return {
            ...c,
            lastMessage: showPreview,
            time: uiMsg.time,
            unread: shouldIncUnread
              ? Number(c.unread || 0) + 1
              : Number(c.unread || 0),
          };
        });
      });
    };

    const normIds = (arr) =>
      Array.from(new Set((arr || []).map((x) => String(x)))).sort();

    const sameArr = (a, b) =>
      a.length === b.length && a.every((v, i) => v === b[i]);

    const onPresenceState = (payload) => {
      const next = normIds(payload?.onlineUserIds);
      setOnlineIds((prev) => {
        const cur = normIds(prev);
        return sameArr(cur, next) ? prev : next;
      });
    };

    const onPresenceUpdate = ({ userId, online }) => {
      const uid = String(userId);
      setOnlineIds((prev) => {
        const set = new Set((prev || []).map(String));
        const had = set.has(uid);

        if (online) set.add(uid);
        else set.delete(uid);

        const hasNow = set.has(uid);
        if (had === hasNow) return prev; // không đổi thì khỏi set

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

    const onUserAvatar = ({ userId, avatarUrl } = {}) => {
      const uid = userId ? String(userId) : "";
      if (!uid) return;

      // 0) nếu là chính mình và parent có setMe
      if (String(uid) === String(meId) && typeof setMe === "function") {
        setMe((prev) => {
          if (!prev) return prev;
          const nextAvatar = avatarUrl || avatarFromName(prev.name || "User");
          return { ...prev, avatarUrl: avatarUrl || null, avatar: nextAvatar };
        });
      }
      // 1) update friends list (list friend / search friend modal...)
      if (typeof setFriends === "function") {
        setFriends((prev) =>
          prev.map((f) => {
            if (String(f.id) !== uid) return f;
            const nextAvatar = avatarUrl || avatarFromName(f.name || "User");
            return { ...f, avatarUrl: avatarUrl || null, avatar: nextAvatar };
          }),
        );
      }

      // 2) update avatar trong messages hiện có (để đoạn chat đổi avatar ngay)
      setMessagesByChatId((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const cid of Object.keys(next)) {
          const list = next[cid] || [];
          const newList = list.map((m) => {
            let mm = m;

            // avatar của sender
            if (String(m.senderId) === uid) {
              const nextAvatar = avatarUrl || avatarFromName(m.name || "User");
              if (
                m.avatar !== nextAvatar ||
                m.avatarUrl !== (avatarUrl || null)
              ) {
                mm = {
                  ...mm,
                  avatar: nextAvatar,
                  avatarUrl: avatarUrl || null,
                };
                changed = true;
              }
            }

            // avatar của replyTo.sender (nếu UI có render)
            if (
              mm.replyTo?.sender?.id &&
              String(mm.replyTo.sender.id) === uid
            ) {
              mm = {
                ...mm,
                replyTo: {
                  ...mm.replyTo,
                  sender: {
                    ...mm.replyTo.sender,
                    avatarUrl: avatarUrl || null,
                  },
                },
              };
              changed = true;
            }

            return mm;
          });
          if (newList !== list) next[cid] = newList;
        }
        return changed ? next : prev;
      });

      // 3) reload conversations để sidebar/list cuộc trò chuyện + conversation info cập nhật avatar mới
      reloadConversationsRef.current?.(String(meId));
    };

    const onConversationRead = ({ conversationId, userId, at, snapshot }) => {
      if (!conversationId || !userId || !at) return;
      const cid = String(conversationId);
      const uid = String(userId);
      if (uid === String(meId) && !snapshot) reloadConversationsRef.current?.(String(meId)).catch(() => {});

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
      reloadConversationsRef.current?.(String(meId)).catch(error => console.error("Conversation sync failed", error));
      const cid = activeChatIdRef.current;
      if (cid) {
        socket.emit("conversation:join", String(cid));
      }

      // Request a fresh snapshot on every connection, including reconnects.
      socket.emit("presence:sync");
    };

    const onMessageMutation = (payload = {}) => {
      const cid = String(payload.conversationId || "");
      if (!cid || !payload.id) return;
      // All mutation events carry a complete serialized message and revision.
      setMessagesByChatId(prev => ({ ...prev,
        [cid]: mergeMessages(prev[cid] || [], [mapMessage(payload, meId)]),
      }));
      reloadConversationsRef.current?.(String(meId)).catch(() => {});
    };
    const onMessageReaction = onMessageMutation;
    const onMessageEdited = onMessageMutation;
    const onMessageRecalled = onMessageMutation;
    const onMessagePinned = onMessageMutation;

    const onConversationRemoved = ({ conversationId }) => {
      const cid = String(conversationId);
      setChats(prev => prev.filter(c => String(c.id) !== cid));
      setMessagesByChatId(prev => { const next = { ...prev }; delete next[cid]; return next; });
      setTypingByConvo(prev => { const next = { ...prev }; delete next[cid]; return next; });
    };

    const onNotification = (payload) => {
      const fn = onNotificationNewRef.current;
      if (typeof fn === "function") fn(payload);
    };

    const onConversationNew = () => {
      // chỉ cần reload list conversations thôi
      const fn = reloadConversationsRef.current;
      if (typeof fn === "function") fn(String(meId)).catch(() => {});
    };

    const onConversationUpdated = () => {
      const fn = reloadConversationsRef.current;
      if (typeof fn === "function") fn(String(meId)).catch(() => {});
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

    socket.on("user:avatar", onUserAvatar);
    socket.on("conversation:new", onConversationNew);

    socket.on("conversation:updated", onConversationUpdated);
    socket.on("conversation:removed", onConversationRemoved);

    if (socket.connected) {
      onConnect(); // vì connect event sẽ không bắn lại trong case StrictMode
    } else {
      socket.connect();
    }

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

      socket.off("user:avatar", onUserAvatar);
      socket.off("conversation:new", onConversationNew);

      socket.off("conversation:updated", onConversationUpdated);
      socket.off("conversation:removed", onConversationRemoved);

    };
  }, [meId, setChats, setMessagesByChatId, setOnlineIds, activeChatIdRef, setFriends, setMe]);

  return { typingByConvo, lastReadByConvo };
}
