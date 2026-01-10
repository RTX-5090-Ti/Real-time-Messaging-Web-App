import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/chat/Sidebar.jsx";
import ChatWindow from "../components/chat/ChatWindow.jsx";
import GroupInfo from "../components/chat/GroupInfo.jsx";
import { socket } from "../socket/socket.js";
import { AuthAPI } from "../api/auth.api.js";
import { ChatAPI } from "../api/chat.api.js";
import {
  avatarFromName,
  formatTime,
  formatTimeOrDate,
} from "../utils/chatUi.js";
import SearchFriendModal from "../components/chat/SearchFriendModal.jsx";

function bumpChat(list, chatId, updater) {
  const id = String(chatId);
  const idx = list.findIndex((c) => String(c.id) === id);
  if (idx < 0) return list;

  const current = list[idx];
  const updated = typeof updater === "function" ? updater(current) : current;

  // nếu mày có pinned thì giữ pinned ở trên
  const pinned = list.filter((c) => c.pinned);
  const others = list.filter((c) => !c.pinned && String(c.id) !== id);

  if (updated.pinned) {
    const pinnedOthers = pinned.filter((c) => String(c.id) !== id);
    return [updated, ...pinnedOthers, ...others];
  }

  return [...pinned, updated, ...others];
}

function getErrMsg(e) {
  return e?.response?.data?.message || e?.message || "Request failed";
}

function notiKey(userId) {
  return `noti:${String(userId)}`;
}
function keyOf(n) {
  return `${n.type}:${n.requestId || n.id}`;
}
function countUnread(items) {
  return (items || []).filter((x) => !x.readAt).length;
}
function loadNotiFromLS(userId) {
  try {
    const raw = localStorage.getItem(notiKey(userId));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function saveNotiToLS(userId, items) {
  try {
    localStorage.setItem(notiKey(userId), JSON.stringify(items.slice(0, 50)));
  } catch {
    // Ignore socket errors on logout
  }
}

export default function ChatPage() {
  const navigate = useNavigate();

  const [me, setMe] = useState(null);
  const [tab, setTab] = useState("chats");
  const [infoOpen, setInfoOpen] = useState(false);

  const [chats, setChats] = useState([]);
  const [friends, setFriends] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messagesByChatId, setMessagesByChatId] = useState({});
  const [searchOpen, setSearchOpen] = useState(false);

  const [notiOpen, setNotiOpen] = useState(false);
  const [notiItems, setNotiItems] = useState([]);
  const [notiCount, setNotiCount] = useState(0);

  // Presence + Typing
  const [onlineIds, setOnlineIds] = useState([]);
  const onlineSet = useMemo(() => new Set(onlineIds), [onlineIds]);

  const notiOpenRef = useRef(false);

  useEffect(() => {
    notiOpenRef.current = notiOpen;
  }, [notiOpen]);

  useEffect(() => {
    if (!me?.id) return;
    if (!socket.connected) return;

    const joined = joinedConvosRef.current;

    // join tất cả convo hiện có
    for (const c of chats) {
      const cid = String(c.id);
      if (!joined.has(cid)) {
        socket.emit("conversation:join", cid);
        joined.add(cid);
      }
    }

    // (optional) leave những convo không còn trong list
    const currentIds = new Set(chats.map((c) => String(c.id)));
    for (const cid of Array.from(joined)) {
      if (!currentIds.has(cid)) {
        socket.emit("conversation:leave", cid);
        joined.delete(cid);
      }
    }
  }, [me?.id, chats, socket.connected]);

  // keep online latest for mapping after users load
  const onlineIdsRef = useRef([]);
  useEffect(() => {
    onlineIdsRef.current = onlineIds;
  }, [onlineIds]);

  // typing: { [conversationId]: { [userId]: name } }
  const [typingByConvo, setTypingByConvo] = useState({});

  // read receipt: { [conversationId]: { [userId]: ISOString } }
  const [lastReadByConvo, setLastReadByConvo] = useState({});

  const joinedRoomRef = useRef(null);
  const activeChatIdRef = useRef(null);
  const joinedConvosRef = useRef(new Set());

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  const activeChat = useMemo(
    () => chats.find((c) => c.id === activeChatId) || null,
    [chats, activeChatId]
  );

  const messages = useMemo(
    () => messagesByChatId[activeChatId] ?? [],
    [messagesByChatId, activeChatId]
  );

  const groupInfo = useMemo(() => {
    const rawMembers = activeChat?._raw?.members || [];
    const mapped = rawMembers.map((m) => ({
      id: String(m.id),
      name: m.name,
      email: m.email,
      role: m.role,
      avatar: avatarFromName(m.name || "User"),
    }));

    return {
      files: [
        { label: "Images", count: 0 },
        { label: "Videos", count: 0 },
        { label: "Docs", count: 0 },
      ],
      members: mapped,
    };
  }, [activeChat]);

  const sortedFriends = useMemo(() => {
    const list = Array.isArray(friends) ? [...friends] : [];
    list.sort((a, b) => {
      const ao = a?.status === "online" ? 0 : 1;
      const bo = b?.status === "online" ? 0 : 1;
      if (ao !== bo) return ao - bo;

      const an = String(a?.name || "");
      const bn = String(b?.name || "");
      const byName = an.localeCompare(bn, "vi", { sensitivity: "base" });
      if (byName !== 0) return byName;

      return String(a?.id || "").localeCompare(String(b?.id || ""));
    });
    return list;
  }, [friends]);

  const activeOtherOnline = useMemo(() => {
    if (!activeChat?.otherUserId) return false;
    return onlineSet.has(String(activeChat.otherUserId));
  }, [activeChat?.otherUserId, onlineSet]);

  const typingText = useMemo(() => {
    if (!activeChatId) return null;
    const byUser = typingByConvo[activeChatId];
    if (!byUser) return null;
    const names = Object.values(byUser).filter(Boolean);
    if (!names.length) return null;
    return `${names[0]} is typing…`;
  }, [typingByConvo, activeChatId]);

  // ===== Seen-by avatars (Messenger style) =====
  const seenBy = useMemo(() => {
    if (!activeChatId || !activeChat?.otherUserId) return [];
    const list = messagesByChatId[activeChatId] ?? [];
    if (!list.length) return [];

    const last = list[list.length - 1];
    if (last.from !== "me") return [];

    const otherId = String(activeChat.otherUserId);
    const readAt = lastReadByConvo[activeChatId]?.[otherId];
    if (!readAt) return [];

    const readMs = new Date(readAt).getTime();
    const msgMs = new Date(last.createdAt ?? 0).getTime();
    if (!msgMs || Number.isNaN(msgMs)) return [];

    if (readMs >= msgMs) {
      return [
        {
          id: otherId,
          name: activeChat.name,
          avatar: activeChat.avatar || avatarFromName(activeChat.name),
          at: readAt,
        },
      ];
    }
    return [];
  }, [
    activeChatId,
    activeChat?.otherUserId,
    activeChat?.avatar,
    activeChat?.name,
    lastReadByConvo,
    messagesByChatId,
  ]);

  // ===== Friends + incoming requests =====
  const loadFriends = async () => {
    const { data } = await ChatAPI.listFriends();
    const list = (data.friends || []).map((u) => ({
      id: String(u.id),
      name: u.name,
      email: u.email,
      role: u.role,
      avatar: avatarFromName(u.name),
      status: onlineSet.has(String(u.id)) ? "online" : "offline",
    }));
    setFriends(list);
  };

  const markAllNotiRead = () => {
    const now = new Date().toISOString();

    setNotiItems((prev) => {
      const next = prev.map((n) => (n.readAt ? n : { ...n, readAt: now }));
      // badge dựa trên unread => sau khi mark thì = 0
      setNotiCount(0);
      return next;
    });
  };

  const pushSelfFriendActionNoti = (requestId, fromUser, action) => {
    const now = new Date().toISOString();

    // action: "accepted" | "rejected"
    const type =
      action === "accepted"
        ? "friend_request_accepted_self"
        : "friend_request_rejected_self";

    const item = {
      id: `self:${type}:${requestId}:${Date.now()}`,
      requestId: String(requestId),
      type,
      createdAt: now,
      readAt: now, // ✅ vì mình vừa bấm nên coi như đã đọc
      from: fromUser
        ? {
            id: String(fromUser.id),
            name: fromUser.name,
            email: fromUser.email,
            avatar: fromUser.avatar || avatarFromName(fromUser.name),
          }
        : null,
      by: {
        id: String(me.id),
        name: "You",
        email: me.email || "",
        avatar: me.avatar || avatarFromName(me.name),
      },
    };

    setNotiItems((prev) => {
      // xoá pending friend_request cùng requestId (nếu còn)
      const filtered = prev.filter(
        (n) =>
          !(
            n.type === "friend_request" &&
            String(n.requestId) === String(requestId)
          )
      );

      // chống trùng
      const exists = filtered.some((n) => keyOf(n) === keyOf(item));
      const next = exists ? filtered : [item, ...filtered];

      setNotiCount(notiOpenRef.current ? 0 : countUnread(next));
      return next;
    });
  };

  const loadIncomingRequests = async () => {
    const { data } = await ChatAPI.listIncomingRequests("pending");

    const reqItems = (data.requests || [])
      .filter((r) => r?.from)
      .map((r) => ({
        id: String(r.id),
        requestId: String(r.id),
        type: "friend_request",
        from: {
          id: String(r.from.id),
          name: r.from.name,
          email: r.from.email,
          avatar: avatarFromName(r.from.name),
        },
        createdAt: r.createdAt,
      }));

    setNotiItems((prev) => {
      const prevMap = new Map(prev.map((n) => [keyOf(n), n]));

      const keep = prev.filter((n) => n.type !== "friend_request");

      const mergedRaw = [...reqItems, ...keep].filter((n, idx, arr) => {
        const k = keyOf(n);
        return idx === arr.findIndex((x) => keyOf(x) === k);
      });

      // giữ readAt cũ nếu có
      const merged = mergedRaw.map((n) => ({
        ...n,
        readAt: prevMap.get(keyOf(n))?.readAt ?? null,
      }));

      setNotiCount(notiOpenRef.current ? 0 : countUnread(merged));
      return merged;
    });
  };

  const searchUserByEmail = async (email) => {
    try {
      const res = await ChatAPI.searchUserByEmail(email);
      const data = res.data;

      return {
        ...data,
        user: data.user
          ? {
              ...data.user,
              id: String(data.user.id),
              avatar: avatarFromName(data.user.name),
            }
          : null,
        incomingRequestId: data.incomingRequestId
          ? String(data.incomingRequestId)
          : null,
        outgoingRequestId: data.outgoingRequestId
          ? String(data.outgoingRequestId)
          : null,
      };
    } catch (e) {
      //  404 = không tìm thấy user -> trả về user null để modal show "User not found"
      if (e?.response?.status === 404) {
        return { user: null, relationship: "none" };
      }

      // các lỗi khác thì vẫn throw
      const msg = e?.response?.data?.message || e?.message || "Search failed";
      throw new Error(msg);
    }
  };

  const sendFriendRequest = async (toUserId) => {
    await ChatAPI.sendFriendRequest(toUserId);
  };

  const acceptRequest = async (requestId) => {
    // lấy info người gửi từ noti hiện tại để show "You accepted X"
    const req = notiItems.find(
      (n) =>
        n.type === "friend_request" && String(n.requestId) === String(requestId)
    );
    const fromUser = req?.from || null;

    await ChatAPI.acceptRequest(requestId);

    pushSelfFriendActionNoti(requestId, fromUser, "accepted");

    await Promise.all([loadFriends(), loadIncomingRequests()]);
  };

  const rejectRequest = async (requestId) => {
    const req = notiItems.find(
      (n) =>
        n.type === "friend_request" && String(n.requestId) === String(requestId)
    );
    const fromUser = req?.from || null;

    await ChatAPI.rejectRequest(requestId);

    pushSelfFriendActionNoti(requestId, fromUser, "rejected");

    await loadIncomingRequests();
  };

  useEffect(() => {
    if (!me?.id) return;

    // 1) load local noti (để A F5 vẫn còn accepted/rejected)
    const cached = loadNotiFromLS(me.id);
    setNotiItems(cached);
    setNotiCount(notiOpenRef.current ? 0 : countUnread(cached));

    // 2) rồi mới load từ server (pending friend_request) để merge vào
    loadFriends().catch(() => {});
    loadIncomingRequests().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  useEffect(() => {
    if (!me?.id) return;
    saveNotiToLS(me.id, notiItems);
  }, [me?.id, notiItems]);

  // ===== Initial load: me + conversations + users =====
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const meRes = await AuthAPI.me();
        const meData = meRes.data?.user;
        if (!meData) throw new Error("no user");
        if (cancelled) return;

        const meUI = {
          id: meData.id,
          name: meData.name,
          avatar: avatarFromName(meData.name),
          role: meData.role,
          email: meData.email,
        };
        setMe(meUI);

        const [convosRes, usersRes] = await Promise.all([
          ChatAPI.listConversations(),
          ChatAPI.listUsers(),
        ]);
        if (cancelled) return;

        const convos = convosRes.data?.conversations ?? [];
        const users = usersRes.data?.users ?? [];

        const onlineNow = new Set((onlineIdsRef.current || []).map(String));

        const mappedChats = convos.map((c) => {
          const other =
            c.members?.find((m) => String(m.id) !== String(meUI.id)) ??
            c.members?.[0] ??
            null;

          const name = other?.name ?? "Conversation";
          const lastText = c.lastMessage?.text ?? "";
          const lastTs =
            c.lastMessage?.createdAt ??
            c.lastMessageAt ??
            c.updatedAt ??
            c.createdAt;

          return {
            id: String(c.id),
            name,
            avatar: avatarFromName(name),
            lastMessage: lastText || "Open to see messages",
            time: formatTimeOrDate(lastTs),
            unread: Number(c.unread ?? 0),
            pinned: false,

            members: c.members?.length ?? 2,
            online: other?.id ? (onlineNow.has(String(other.id)) ? 2 : 1) : 0,

            otherUserId: other?.id ? String(other.id) : null,
            _raw: c,
          };
        });

        // listUsers để mày thấy ai đang online/offline (không ảnh hưởng friend tab vì loadFriends sẽ override)
        const mappedFriends = users
          .filter((u) => String(u.id) !== String(meUI.id))
          .map((u) => ({
            id: String(u.id),
            name: u.name,
            avatar: avatarFromName(u.name),
            email: u.email,
            role: u.role,
            status: onlineNow.has(String(u.id)) ? "online" : "offline",
          }));

        setChats(mappedChats);
        setFriends(mappedFriends);

        if (mappedChats.length && !activeChatIdRef.current) {
          setActiveChatId(mappedChats[0].id);
        }
      } catch (e) {
        console.warn("Auth/me failed -> go /auth", e?.message || e);
        navigate("/auth", { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== Socket listeners =====
  useEffect(() => {
    if (!me?.id) return;

    const onNewMessage = (payload) => {
      const { conversationId } = payload || {};
      if (!conversationId) return;

      const sender = payload.sender || payload.senderId || null;
      const senderId = sender?.id ? String(sender.id) : null;
      const senderName = sender?.name ?? "User";

      const createdAt = payload.createdAt ?? new Date().toISOString();

      const uiMsg = {
        id: String(payload.id ?? payload._id ?? Date.now()),
        from: senderId === String(me.id) ? "me" : "other",
        name: senderName,
        avatar: avatarFromName(senderName),
        text: payload.text ?? "",
        time: formatTime(createdAt),
        createdAt,
      };

      setMessagesByChatId((prev) => {
        const list = prev[String(conversationId)] ?? [];
        if (list.some((m) => m.id === uiMsg.id)) return prev;
        return { ...prev, [String(conversationId)]: [...list, uiMsg] };
      });

      setChats((prev) => {
        const cid = String(conversationId);
        const isActive = cid === String(activeChatIdRef.current);
        const isFromMe = senderId === String(me.id);

        //  bump lên đầu cho cả tin mình gửi và tin người khác gửi
        return bumpChat(prev, cid, (c) => {
          const unread = isActive || isFromMe ? 0 : Number(c.unread || 0) + 1;

          return {
            ...c,
            lastMessage: uiMsg.text,
            time: uiMsg.time,
            unread,
          };
        });
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
        const set = new Set(prev.map(String));
        if (online) set.add(uid);
        else set.delete(uid);
        return Array.from(set);
      });
    };

    const onTypingUpdate = ({ conversationId, userId, name, typing }) => {
      if (!conversationId || !userId) return;
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

    const onConnectError = (e) => {
      console.warn("socket connect_error:", e?.message || e);
    };

    const onConnect = () => {
      const cid = activeChatIdRef.current;
      if (cid) socket.emit("conversation:join", cid);
    };

    const onNotificationNew = (payload) => {
      const type = payload?.type;
      if (!type) return;

      const makeUser = (u) =>
        u
          ? {
              id: String(u.id),
              name: u.name || "User",
              email: u.email || "",
              avatar: avatarFromName(u.name || "User"),
            }
          : null;

      const item = {
        id: String(payload.requestId || Date.now()),
        requestId: payload.requestId ? String(payload.requestId) : null,
        type,
        createdAt: payload.createdAt || new Date().toISOString(),
        from: payload.from ? makeUser(payload.from) : null,
        by: payload.by ? makeUser(payload.by) : null,
        readAt: notiOpenRef.current ? new Date().toISOString() : null,
      };

      setNotiItems((prev) => {
        // chống duplicate
        if (
          prev.some(
            (x) =>
              x.type === item.type &&
              x.requestId &&
              x.requestId === item.requestId
          )
        ) {
          return prev;
        }

        const next = [item, ...prev];
        setNotiCount(notiOpenRef.current ? 0 : countUnread(next));
        return next;
      });

      if (type === "friend_request" && notiOpenRef.current) {
        loadIncomingRequests().catch(() => {});
      }

      if (type === "friend_request_accepted") {
        loadFriends().catch(() => {});
      }
    };

    socket.on("connect", onConnect);
    socket.on("message:new", onNewMessage);
    socket.on("presence:state", onPresenceState);
    socket.on("presence:update", onPresenceUpdate);
    socket.on("typing:update", onTypingUpdate);
    socket.on("conversation:read", onConversationRead);
    socket.on("connect_error", onConnectError);
    socket.on("notification:new", onNotificationNew);

    if (!socket.connected) socket.connect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("message:new", onNewMessage);
      socket.off("presence:state", onPresenceState);
      socket.off("presence:update", onPresenceUpdate);
      socket.off("typing:update", onTypingUpdate);
      socket.off("conversation:read", onConversationRead);
      socket.off("connect_error", onConnectError);
      socket.off("notification:new", onNotificationNew);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  // ===== Apply presence to friends/chats =====
  useEffect(() => {
    setFriends((prev) =>
      prev.map((f) => ({
        ...f,
        status: onlineSet.has(String(f.id)) ? "online" : "offline",
      }))
    );

    setChats((prev) =>
      prev.map((c) => ({
        ...c,
        online: c.otherUserId
          ? onlineSet.has(String(c.otherUserId))
            ? 2
            : 1
          : 0,
      }))
    );
  }, [onlineSet]);

  // ===== Join room + load history when activeChatId changes =====
  useEffect(() => {
    if (!me?.id || !activeChatId) return;

    const prevRoom = joinedRoomRef.current;
    if (prevRoom && prevRoom !== activeChatId) {
      socket.emit("typing:stop", { conversationId: prevRoom });
      // socket.emit("conversation:leave", prevRoom);
    }
    joinedRoomRef.current = activeChatId;

    let cancelled = false;

    (async () => {
      try {
        setChats((prev) =>
          prev.map((c) => (c.id === activeChatId ? { ...c, unread: 0 } : c))
        );

        const { data } = await ChatAPI.getMessages(activeChatId);
        if (cancelled) return;

        const msgs = (data?.messages ?? []).map((m) => {
          const sender = m.sender || m.senderId || null;
          const sid = sender?.id ? String(sender.id) : null;
          const sname = sender?.name ?? "User";
          const createdAt = m.createdAt ?? new Date().toISOString();

          return {
            id: String(m.id ?? m._id),
            from: sid === String(me.id) ? "me" : "other",
            name: sname,
            avatar: avatarFromName(sname),
            text: m.text ?? "",
            time: formatTime(createdAt),
            createdAt,
          };
        });

        setMessagesByChatId((prev) => ({ ...prev, [activeChatId]: msgs }));
        if (!joinedConvosRef.current.has(String(activeChatId))) {
          socket.emit("conversation:join", String(activeChatId));
          joinedConvosRef.current.add(String(activeChatId));
        }
      } catch (e) {
        console.error(e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [me?.id, activeChatId]);

  const onSend = (text) => {
    if (!activeChatId) return;

    const now = new Date().toISOString();

    //  chỉ khi gửi mới bump lên đầu
    setChats((prev) =>
      bumpChat(prev, activeChatId, (c) => ({
        ...c,
        lastMessage: text,
        time: formatTime(now),
        unread: 0,
      }))
    );

    if (socket.connected) {
      socket.emit("message:send", { conversationId: activeChatId, text });
      return;
    }
    ChatAPI.sendMessage(activeChatId, text).catch((e) => console.error(e));
  };

  const onLogout = async () => {
    try {
      await AuthAPI.logout();
    } catch {
      // Ignore socket errors on logout
    }

    try {
      if (joinedRoomRef.current) {
        socket.emit("typing:stop", { conversationId: joinedRoomRef.current });
        socket.emit("conversation:leave", joinedRoomRef.current);
      }
      socket.disconnect();
      joinedRoomRef.current = null;
      activeChatIdRef.current = null;
    } catch {
      // Ignore socket errors on logout
    }

    navigate("/auth", { replace: true });
  };

  const onProfile = () => alert("(Demo UI) Profile");
  const onCreateGroup = () => alert("Group chat: not implemented yet.");

  const openChatWithFriend = async (friendId) => {
    const fid = String(friendId || "");
    if (!fid) return;

    const existed = chats.find((c) => String(c.otherUserId || "") === fid);
    if (existed) {
      setActiveChatId(existed.id);
      setTab("chats");
      // reset unread thôi
      setChats((prev) =>
        prev.map((c) => (c.id === String(existed.id) ? { ...c, unread: 0 } : c))
      );

      return;
    }

    try {
      const res = await ChatAPI.createOrGetDirect(fid);
      const newConvoId =
        res.data?.conversation?.id || res.data?.conversationId || res.data?.id;

      const convosRes = await ChatAPI.listConversations();
      const convos = convosRes.data?.conversations ?? [];

      const onlineNow = new Set((onlineIdsRef.current || []).map(String));

      const mapped = convos.map((c) => {
        const other =
          c.members?.find((m) => String(m.id) !== String(me.id)) ??
          c.members?.[0] ??
          null;

        const name = other?.name ?? "Conversation";
        const lastText = c.lastMessage?.text ?? "";
        const lastTs =
          c.lastMessage?.createdAt ??
          c.lastMessageAt ??
          c.updatedAt ??
          c.createdAt;

        return {
          id: String(c.id),
          name,
          avatar: avatarFromName(name),
          lastMessage: lastText || "Open to see messages",
          time: formatTimeOrDate(lastTs),
          unread: Number(c.unread ?? 0),
          pinned: false,
          members: c.members?.length ?? 2,
          online: other?.id ? (onlineNow.has(String(other.id)) ? 2 : 1) : 0,
          otherUserId: other?.id ? String(other.id) : null,
          _raw: c,
        };
      });

      // ✅ set list mới
      setChats(mapped);

      if (newConvoId) {
        const id = String(newConvoId);
        setActiveChatId(id);
        setTab("chats");

        // reset unread (nếu có)
        setChats((prev) =>
          prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c))
        );
      }
    } catch (e) {
      console.error(e);
      alert(getErrMsg(e));
    }
  };

  if (!me) {
    return (
      <div className="w-full h-screen grid place-items-center bg-gradient-to-r from-[#b06ab3] to-[#4568dc]">
        <div className="px-4 py-3 text-white rounded-xl bg-black/20">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen p-4 bg-gradient-to-r from-[#b06ab3] to-[#4568dc]">
      <div className="h-full w-full rounded-[28px] overflow-hidden shadow-xl bg-white flex">
        <Sidebar
          me={me}
          chats={chats}
          friends={sortedFriends}
          activeChatId={activeChatId}
          onSelectChat={(id) => {
            setActiveChatId(id);
            setTab("chats");
            // vẫn reset unread vì đã mở chat
            setChats((prev) =>
              prev.map((c) => (c.id === String(id) ? { ...c, unread: 0 } : c))
            );
          }}
          tab={tab}
          setTab={setTab}
          onLogout={onLogout}
          onProfile={onProfile}
          onFindFriend={() => setSearchOpen(true)}
          onCreateGroup={onCreateGroup}
          onMessageFriend={openChatWithFriend}
          notificationsOpen={notiOpen}
          notificationsCount={notiCount}
          notifications={notiItems}
          onToggleNotifications={() => {
            const next = !notiOpen;
            setNotiOpen(next);
            if (next) {
              //  mở dropdown = đã đọc
              markAllNotiRead();
              //  vẫn load pending từ server để B thấy friend_request
              loadIncomingRequests().catch(() => {});
            }
          }}
          onCloseNotifications={() => {
            setNotiOpen(false);
            setNotiCount(0);
          }}
          onAcceptRequest={(requestId) => acceptRequest(requestId)}
          onRejectRequest={(requestId) => rejectRequest(requestId)}
          onClearAllNotifications={() => {
            setNotiItems([]);
            setNotiCount(0);
          }}
        />

        <ChatWindow
          chat={activeChat}
          messages={messages}
          onSend={onSend}
          onProfile={onProfile}
          otherOnline={activeOtherOnline}
          typingText={typingText}
          seenBy={seenBy}
          onTypingStart={() => {
            if (!activeChatId || !socket.connected) return;
            socket.emit("typing:start", { conversationId: activeChatId });
          }}
          onTypingStop={() => {
            if (!activeChatId || !socket.connected) return;
            socket.emit("typing:stop", { conversationId: activeChatId });
          }}
          isInfoOpen={infoOpen}
          onToggleInfo={() => setInfoOpen((v) => !v)}
        />

        <GroupInfo
          chat={activeChat}
          groupInfo={groupInfo}
          open={infoOpen}
          onClose={() => setInfoOpen(false)}
        />

        <SearchFriendModal
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          onSearchEmail={searchUserByEmail}
          onSendRequest={sendFriendRequest}
          onAccept={acceptRequest}
          onReject={rejectRequest}
        />
      </div>
    </div>
  );
}
