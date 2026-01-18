import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import Sidebar from "../components/chat/Sidebar.jsx";
import ChatWindow from "../components/chat/ChatWindow.jsx";
import GroupInfo from "../components/chat/GroupInfo.jsx";
import SearchFriendModal from "../components/chat/SearchFriendModal.jsx";

import { socket } from "../socket/socket.js";
import { AuthAPI } from "../api/auth.api.js";
import { ChatAPI } from "../api/chat.api.js";

import { avatarFromName, formatTime } from "../utils/chatUi.js";
import { bumpChat } from "../utils/chat/chatPageHelpers.js";

import { useChatBootstrap } from "../hooks/chat/useChatBootstrap.js";
import { useChatHistory } from "../hooks/chat/useChatHistory.js";
import { useChatSocket } from "../hooks/chat/useChatSocket.js";
import { useNotifications } from "../hooks/chat/useNotifications.js";
import { useOpenChatWithFriend } from "../hooks/chat/useOpenChatWithFriend.js";
import AddMemberModal from "../components/chat/AddMemberModal";

import ProfileModal from "../components/chat/ProfileModal.jsx";
import UserProfileModal from "../components/chat/UserProfileModal.jsx";

import CreateGroupModal from "../components/chat/CreateGroupModal.jsx";

export default function ChatPage() {
  const navigate = useNavigate();

  // UI states
  const [tab, setTab] = useState("chats");
  const [infoOpen, setInfoOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [replyDraft, setReplyDraft] = useState(null);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);

  const [deleteModal, setDeleteModal] = useState({
    open: false,
    chat: null,
    busy: false,
  });

  const [recallModal, setRecallModal] = useState({
    open: false,
    cid: null,
    mid: null,
    busy: false,
  });

  const [editModal, setEditModal] = useState({
    open: false,
    cid: null,
    msg: null,
    text: "",
    err: "",
    busy: false,
  });

  const [profileOpen, setProfileOpen] = useState(false);

  const [otherProfile, setOtherProfile] = useState({
    open: false,
    userId: null,
    seedUser: null,
  });

  const [addOpen, setAddOpen] = useState(false);

  const onAddMember = () => setAddOpen(true);

  const onPickAddMember = async (u) => {
    if (!activeChatId) return;

    try {
      await ChatAPI.addGroupMember(String(activeChatId), String(u.id));
      setAddOpen(false);
    } catch (err) {
      console.log("Add member failed:", err);
      alert(err?.response?.data?.message || "Add member failed");
    }
  };

  const openOtherProfile = (userId, seedUser = null) => {
    const id = String(userId || "");
    if (!id) return;
    setOtherProfile({ open: true, userId: id, seedUser });
  };

  const closeOtherProfile = () => {
    setOtherProfile({ open: false, userId: null, seedUser: null });
  };

  const closeRecallModal = () => {
    setRecallModal((s) =>
      s.busy ? s : { open: false, cid: null, mid: null, busy: false },
    );
  };

  const closeEditModal = () => {
    setEditModal((s) =>
      s.busy
        ? s
        : { open: false, cid: null, msg: null, text: "", err: "", busy: false },
    );
  };

  // core states + bootstrap
  const {
    me,
    setMe,
    chats,
    setChats,
    friends,
    setFriends,

    activeChatId,
    setActiveChatId,
    activeChatIdRef,

    messagesByChatId,
    setMessagesByChatId,
    // onlineIds,
    onlineSet,
    setOnlineIds,
    onlineIdsRef,

    joinedRoomRef,

    reloadConversations,
  } = useChatBootstrap({ navigate });

  // notifications
  const noti = useNotifications({ me, onlineSet, setFriends });

  // socket listeners (messages/presence/typing/read + notification callback)
  const { typingByConvo, lastReadByConvo } = useChatSocket({
    meId: me?.id ? String(me.id) : null,
    chats,
    setChats,
    socket,
    setFriends,
    setMessagesByChatId,
    setOnlineIds,
    activeChatIdRef,
    onNotificationNew: noti.onNotificationNew,
    reloadConversations,
  });

  const previewTextFromAttachments = (attachments) => {
    if (!Array.isArray(attachments) || attachments.length === 0) return "";
    const a = attachments[0] || {};
    const mime = String(a.mime || "").toLowerCase();
    const url = String(a.url || "").toLowerCase();

    if (mime === "image/gif" || url.endsWith(".gif")) return "GIF";
    if (mime.startsWith("image/") || a.kind === "image") return "Photo";
    return a.name ? `File: ${a.name}` : "Attachment";
  };

  const makeReplyDraft = (msg) => {
    const preview =
      String(msg?.text || "").trim() ||
      previewTextFromAttachments(msg?.attachments) ||
      "Message";
    return {
      id: String(msg.id),
      name: msg?.name || "User",
      preview,
    };
  };

  const onReplySelect = (msg) => {
    setReplyDraft(makeReplyDraft(msg));
  };

  useEffect(() => {
    setReplyDraft(null);
  }, [activeChatId]);

  // load history when switching chat
  const { hasMore, loadingMore, loadMore } = useChatHistory({
    meId: me?.id ? String(me.id) : null,
    activeChatId,
    setChats,
    setMessagesByChatId,
  });

  const openDeleteModal = (chat) => {
    if (!chat?.id) return;
    setDeleteModal({ open: true, chat, busy: false });
  };

  const closeDeleteModal = () => {
    setDeleteModal({ open: false, chat: null, busy: false });
  };

  useEffect(() => {
    if (!deleteModal.open) return;
    const onEsc = (e) => {
      if (e.key === "Escape") closeDeleteModal();
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [deleteModal.open]);

  const confirmDeleteChat = async () => {
    const chat = deleteModal.chat;
    const cid = String(chat?.id || "");
    if (!cid || deleteModal.busy) return;

    setDeleteModal((s) => ({ ...s, busy: true }));
    try {
      await ChatAPI.deleteConversation(cid);

      // Remove from UI immediately
      setChats((prev) => {
        const next = (prev || []).filter((c) => String(c.id) !== cid);

        // nếu đang ở đúng chat đó => chuyển sang chat khác (hoặc null)
        if (String(activeChatIdRef.current || "") === cid) {
          const nextActive = next[0]?.id ? String(next[0].id) : null;
          setActiveChatId(nextActive);
        }
        return next;
      });

      // clear cache messages để không còn “tin cũ trong memory”
      setMessagesByChatId((prev) => {
        const next = { ...(prev || {}) };
        delete next[cid];
        return next;
      });

      reloadConversations?.(String(me?.id || "")).catch(() => {});
      closeDeleteModal();
    } catch (err) {
      console.error(err);
      // nếu muốn đẹp hơn thì đổi sang toast, tạm thời vẫn alert
      alert(err?.response?.data?.message || "Delete chat failed");
      setDeleteModal((s) => ({ ...s, busy: false }));
    }
  };

  // ✅ keep socket room in sync with active chat (join ONLY active, leave old)
  useEffect(() => {
    if (!me?.id) return;

    const nextCid = activeChatId ? String(activeChatId) : null;
    const prevCid = joinedRoomRef?.current
      ? String(joinedRoomRef.current)
      : null;

    // leave old room (and stop typing there)
    if (prevCid && prevCid !== nextCid && socket.connected) {
      socket.emit("typing:stop", {
        conversationId: prevCid,
        userId: String(me.id),
        name: me.name || "User",
      });
      socket.emit("conversation:leave", prevCid);
    }

    // join new room
    joinedRoomRef.current = nextCid;

    if (nextCid && socket.connected) {
      socket.emit("conversation:join", nextCid);
      socket.emit("conversation:read", {
        conversationId: nextCid,
        at: new Date().toISOString(),
      });
    }
  }, [activeChatId, me?.id, me?.name]);

  // ✅ on unmount: leave current room
  useEffect(() => {
    return () => {
      const cid = joinedRoomRef?.current;
      if (cid && socket.connected)
        socket.emit("conversation:leave", String(cid));
    };
  }, []);
  const activeChat = useMemo(
    () => chats.find((c) => c.id === activeChatId) || null,
    [chats, activeChatId],
  );

  const messages = useMemo(
    () => messagesByChatId[activeChatId] ?? [],
    [messagesByChatId, activeChatId],
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

    // ===== derive shared items from messages (images/videos/gifs/files)
    const list = Array.isArray(messages) ? messages : [];

    let images = 0;
    let videos = 0;
    let docs = 0;

    const mediaAll = [];
    const mediaItems = []; // preview 9
    const fileAll = [];
    const fileItems = []; // preview 8

    const isGifUrl = (url) => /\.gif(\?|$)/i.test(String(url || ""));

    // iterate from newest -> oldest so preview is newest
    for (let mi = list.length - 1; mi >= 0; mi--) {
      const msg = list[mi];
      const atts = Array.isArray(msg?.attachments) ? msg.attachments : [];

      for (let ai = 0; ai < atts.length; ai++) {
        const a = atts[ai];
        if (!a?.url) continue;

        const kind = String(a.kind || "").toLowerCase();
        const mime = String(a.mime || a.contentType || "").toLowerCase();
        const url = a.url;

        const gif = kind === "gif" || mime === "image/gif" || isGifUrl(url);
        const image = gif || kind === "image" || mime.startsWith("image/");
        const video = kind === "video" || mime.startsWith("video/");

        if (image) images++;
        else if (video) videos++;
        else docs++;

        const item = {
          key: `${msg?.id || "msg"}:${ai}`,
          url,
          kind: video ? "video" : gif ? "gif" : image ? "image" : "file",
          name:
            a.name ||
            a.originalName ||
            a.filename ||
            a.public_id ||
            a.key ||
            "",
          size: a.size,
          mime,
          createdAt: msg?.createdAt,
        };

        if (image || video) {
          mediaAll.push(item);
          if (mediaItems.length < 9) mediaItems.push(item);
        } else {
          fileAll.push(item);
          if (fileItems.length < 8) fileItems.push(item);
        }
      }
    }

    return {
      // giữ field cũ để khỏi đụng logic cũ
      files: [
        { label: "Images", count: images },
        { label: "Videos", count: videos },
        { label: "Docs", count: docs },
      ],
      members: mapped,

      // ✅ thêm field mới cho UI render preview (không phá logic cũ)
      mediaItems,
      fileItems,
      mediaAll,
      fileAll,
      counts: { images, videos, docs, mediaTotal: images + videos },
    };
  }, [activeChat, messages]);

  const onReactMessage = async (messageId, emoji) => {
    if (!activeChatId || !me?.id) return;
    const cid = String(activeChatId);
    const uid = String(me.id);

    // optimistic UI (giữ y như logic cũ của mày)
    setMessagesByChatId((prev) => {
      const list = prev[cid] ?? [];
      const idx = list.findIndex((m) => String(m.id) === String(messageId));
      if (idx === -1) return prev;

      const msg = list[idx];
      const cur = Array.isArray(msg.reactions) ? msg.reactions : [];
      const existIdx = cur.findIndex((r) => String(r.userId) === uid);

      let nextReactions = [...cur];
      if (existIdx >= 0) {
        if (nextReactions[existIdx].emoji === emoji)
          nextReactions.splice(existIdx, 1); // toggle off
        else nextReactions[existIdx] = { ...nextReactions[existIdx], emoji }; // replace
      } else {
        nextReactions.push({ userId: uid, emoji });
      }

      const next = [...list];
      next[idx] = { ...msg, reactions: nextReactions };
      return { ...prev, [cid]: next };
    });

    // ✅ persist + broadcast
    if (!socket.connected) return; // offline thì không lưu được

    socket
      .timeout(8000)
      .emit(
        "message:react",
        { conversationId: cid, messageId, emoji },
        (err, res) => {
          // không cần làm gì thêm: server sẽ bắn "message:reaction" về và useChatSocket sẽ patch lại
          if (err || !res?.ok) console.warn("react failed:", err || res);
        },
      );
  };

  const onPinMessage = async (messageId) => {
    if (!activeChatId || !messageId) return;
    const cid = String(activeChatId);

    // optimistic: toggle pinned (không đổi UI, chỉ lưu state)
    setMessagesByChatId((prev) => {
      const list = prev[cid] ?? [];
      const idx = list.findIndex((m) => String(m.id) === String(messageId));
      if (idx === -1) return prev;
      const cur = list[idx];
      const next = [...list];
      next[idx] = { ...cur, pinned: !cur.pinned };
      return { ...prev, [cid]: next };
    });

    try {
      if (socket.connected) {
        await new Promise((resolve, reject) => {
          socket
            .timeout(8000)
            .emit(
              "message:pin",
              { conversationId: cid, messageId: String(messageId) },
              (err, res) => {
                if (err) return reject(err);
                if (!res?.ok)
                  return reject(new Error(res?.error || "PIN_FAILED"));
                resolve(res);
              },
            );
        });
        return;
      }

      // fallback REST
      await ChatAPI.togglePinMessage(String(messageId));
    } catch (e) {
      console.warn(e);
      // revert
      setMessagesByChatId((prev) => {
        const list = prev[cid] ?? [];
        const idx = list.findIndex((m) => String(m.id) === String(messageId));
        if (idx === -1) return prev;
        const cur = list[idx];
        const next = [...list];
        next[idx] = { ...cur, pinned: !cur.pinned };
        return { ...prev, [cid]: next };
      });
    }
  };

  const onEditMessage = (msg) => {
    if (!activeChatId || !me?.id || !msg?.id) return;
    if (msg.from !== "me") return;

    setEditModal({
      open: true,
      cid: String(activeChatId),
      msg,
      text: String(msg.text || ""),
      err: "",
      busy: false,
    });
  };

  const confirmEditMessage = async () => {
    const cid = String(editModal.cid || "");
    const msg = editModal.msg;
    const mid = String(msg?.id || "");
    const oldText = String(msg?.text || "");

    const trimmed = String(editModal.text || "").trim();
    if (!trimmed) {
      setEditModal((s) => ({ ...s, err: "Không được để trống." }));
      return;
    }
    if (!cid || !mid || editModal.busy) return;

    setEditModal((s) => ({ ...s, busy: true, err: "" }));

    // optimistic
    patchMessage(cid, mid, {
      text: trimmed,
      editedAt: new Date().toISOString(),
    });

    try {
      if (socket.connected) {
        await new Promise((resolve, reject) => {
          socket
            .timeout(8000)
            .emit(
              "message:edit",
              { conversationId: cid, messageId: mid, text: trimmed },
              (err, res) => {
                if (err) return reject(err);
                if (!res?.ok)
                  return reject(new Error(res?.error || "EDIT_FAILED"));
                resolve(res);
              },
            );
        });
      } else {
        await ChatAPI.editMessage(mid, { text: trimmed });
      }

      setEditModal({
        open: false,
        cid: null,
        msg: null,
        text: "",
        err: "",
        busy: false,
      });
    } catch (e) {
      console.warn(e);
      patchMessage(cid, mid, { text: oldText });
      setEditModal((s) => ({ ...s, busy: false }));
    }
  };

  const onRecallMessage = (messageId) => {
    if (!activeChatId || !messageId) return;
    setRecallModal({
      open: true,
      cid: String(activeChatId),
      mid: String(messageId),
      busy: false,
    });
  };

  const confirmRecallMessage = async () => {
    const cid = String(recallModal.cid || "");
    const mid = String(recallModal.mid || "");
    if (!cid || !mid || recallModal.busy) return;

    setRecallModal((s) => ({ ...s, busy: true }));

    // backup để revert nếu fail
    const backup = (messagesByChatId[cid] ?? []).find(
      (m) => String(m.id) === mid,
    );

    // optimistic
    patchMessage(cid, mid, {
      text: "Đã thu hồi tin nhắn",
      attachments: [],
      reactions: [],
      isRecalled: true,
      recalledAt: new Date().toISOString(),
    });

    try {
      if (socket.connected) {
        await new Promise((resolve, reject) => {
          socket
            .timeout(8000)
            .emit(
              "message:recall",
              { conversationId: cid, messageId: mid },
              (err, res) => {
                if (err) return reject(err);
                if (!res?.ok)
                  return reject(new Error(res?.error || "RECALL_FAILED"));
                resolve(res);
              },
            );
        });
      } else {
        await ChatAPI.recallMessage(mid);
      }

      setRecallModal({ open: false, cid: null, mid: null, busy: false });
    } catch (e) {
      console.warn(e);
      if (backup) patchMessage(cid, mid, backup);
      setRecallModal((s) => ({ ...s, busy: false }));
    }
  };

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

  const patchMessage = (conversationId, messageId, patch) => {
    const cid = String(conversationId);
    setMessagesByChatId((prev) => {
      const list = prev[cid] ?? [];
      const idx = list.findIndex((m) => m.id === messageId);
      if (idx === -1) return prev;
      const next = [...list];
      next[idx] = {
        ...next[idx],
        ...(typeof patch === "function" ? patch(next[idx]) : patch),
      };
      return { ...prev, [cid]: next };
    });
  };

  const markFailed = (conversationId, tmpId, errorMsg = "Failed") => {
    patchMessage(conversationId, tmpId, { status: "failed", errorMsg });
  };

  const sendWithRetry = async ({
    conversationId,
    text,
    files = [],
    gifAttachments = [],
    rawAttachments = [],
    tmpId, // nếu retry thì truyền tmpId
    clientId, // nếu retry thì giữ clientId cũ
    replyTo = null,
  }) => {
    const cid = String(conversationId);
    const safeText = String(text || "").trim();
    const safeFiles = Array.isArray(files) ? files : [];
    const safeGifs = Array.isArray(gifAttachments) ? gifAttachments : [];
    const safeRaw = Array.isArray(rawAttachments) ? rawAttachments : [];

    const cId =
      clientId || `c_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const tempId = tmpId || `tmp:${cId}`;

    // ✅ retry: set lại sending

    patchMessage(cid, tempId, { status: "sending", errorMsg: "" });

    try {
      // 1) build attachments cuối cùng (upload ảnh/file local)
      const attachments = [];
      for (const a of safeRaw)
        if (a?.url) attachments.push({ kind: a.kind || "file", ...a });

      for (const f of safeFiles) {
        const { data } = await ChatAPI.uploadSingle(f);
        const up = data?.file;
        if (up?.url) attachments.push({ kind: up.kind || "file", ...up });
      }

      for (const g of safeGifs) {
        if (g?.kind === "gif" && g?.url) attachments.push(g);
      }

      const payload = {
        conversationId: cid,
        text: safeText || "",
        attachments,
        clientId: cId,
        replyTo: replyTo || null,
      };

      // 2) send (socket có ACK + timeout)
      if (socket.connected) {
        await new Promise((resolve, reject) => {
          socket.timeout(12000).emit("message:send", payload, (err, res) => {
            if (err) return reject(err);
            if (!res?.ok) return reject(new Error(res?.error || "SEND_FAILED"));
            resolve(res);
          });
        });
        // ✅ không cần set "sent" ở đây, vì message:new sẽ về và replace
        return;
      }

      // 3) fallback REST: nếu thành công thì replace luôn (vì offline không có socket message:new)
      const res = await ChatAPI.sendMessage(cid, {
        text: payload.text,
        attachments: payload.attachments,
        replyTo: payload.replyTo,
      });
      const m = res?.data?.message;
      if (m?.id || m?._id) {
        // map về format UI giống useChatHistory/useChatSocket
        const sender = m.sender || m.senderId || {};
        const senderName = sender.name ?? me?.name ?? "User";
        const senderAvatarUrl =
          sender.avatarUrl ?? sender.avatar?.url ?? sender.avatar ?? null;
        const createdAt = m.createdAt || new Date().toISOString();
        const uiMsg = {
          id: String(m.id ?? m._id),
          from: String(sender.id) === String(me?.id) ? "me" : "other",
          name: senderName,
          avatarUrl: senderAvatarUrl,
          avatar: senderAvatarUrl || avatarFromName(senderName),
          text: m.text ?? "",
          attachments: Array.isArray(m.attachments) ? m.attachments : [],
          time: formatTime(createdAt),
          createdAt,
        };
        patchMessage(cid, tempId, {
          ...uiMsg,
          status: undefined,
          errorMsg: "",
          __retryPayload: undefined,
        });
      } else {
        // nếu backend không trả message thì coi như fail
        throw new Error("REST_SEND_NO_MESSAGE");
      }
    } catch (e) {
      console.error(e);
      markFailed(cid, tempId, "Failed • Retry");
    }
  };

  const activeOtherOnline =
    !!activeChat?.otherUserId && onlineSet.has(String(activeChat.otherUserId));

  const typingText = useMemo(() => {
    if (!activeChatId) return null;

    const byUser = typingByConvo[activeChatId];
    if (!byUser) return null;

    const names = Object.values(byUser).filter(Boolean);
    const uniq = Array.from(new Set(names));
    if (!uniq.length) return null;

    const isGroup = activeChat?.type === "group";

    // 1-1: giữ kiểu cũ
    if (!isGroup) return `${uniq[0]} is typing…`;

    // Group: show nhiều người
    if (uniq.length === 1) return `${uniq[0]} is typing…`;
    if (uniq.length === 2) return `${uniq[0]} and ${uniq[1]} are typing…`;

    const rest = uniq.length - 2;
    return `${uniq[0]}, ${uniq[1]} and ${rest} others are typing…`;
  }, [typingByConvo, activeChatId, activeChat?.type]);

  // seen-by avatars
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
  }, [activeChatId, activeChat, lastReadByConvo, messagesByChatId]);

  const openChatWithFriend = useOpenChatWithFriend({
    meId: me?.id ? String(me.id) : null,
    chats,
    setChats,
    setActiveChatId,
    setTab,
    onlineIdsRef,
  });

  // ===== SEND: text-only =====
  const onSendText = (text) => {
    if (!activeChatId) return;
    const cid = String(activeChatId);

    const clientId = `c_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const tmpId = `tmp:${clientId}`;
    const now = new Date().toISOString();

    const optimistic = {
      id: tmpId,
      clientId,
      from: "me",
      name: me?.name || "Me",
      avatarUrl: me?.avatarUrl || null,
      avatar: me?.avatarUrl || me?.avatar || avatarFromName(me?.name || "Me"),
      text,
      attachments: [],
      time: formatTime(now),
      createdAt: now,
      status: "sending",
      __retryPayload: {
        conversationId: cid,
        text,
        replyTo: replyDraft?.id || null,
      },
      replyTo: replyDraft
        ? {
            id: replyDraft.id,
            sender: { name: replyDraft.name },
            text: replyDraft.preview,
          }
        : null,
      reactions: [],
    };

    setMessagesByChatId((prev) => {
      const list = prev[cid] ?? [];
      return { ...prev, [cid]: [...list, optimistic] };
    });
    setChats((prev) =>
      bumpChat(prev, cid, (c) => ({
        ...c,
        lastMessage: text,
        time: formatTime(now),
        unread: 0,
      })),
    );

    sendWithRetry({
      conversationId: cid,
      text,
      tmpId,
      clientId,
      replyTo: replyDraft?.id || null,
    });
  };

  // ===== SEND: text + files + giphy GIF (upload files first, GIF is URL-only) =====
  const onSendMessage = ({ text, files, gifAttachments, rawAttachments }) => {
    if (!activeChatId) return;
    const cid = String(activeChatId);

    const clientId = `c_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const tmpId = `tmp:${clientId}`;
    const now = new Date().toISOString();

    const optimistic = {
      id: tmpId,
      clientId,
      from: "me",
      name: me?.name || "Me",
      avatar: me?.avatar || avatarFromName(me?.name || "Me"),
      text: String(text || ""),
      attachments: [
        ...(Array.isArray(rawAttachments) ? rawAttachments : []),
        // local files muốn “hiện liền” thì add blob-url ở đây (nếu mày đã làm step optimistic preview)
      ],
      time: formatTime(now),
      createdAt: now,
      status: "sending",
      __retryPayload: {
        conversationId: cid,
        text,
        files,
        gifAttachments,
        rawAttachments,
        replyTo: replyDraft?.id || null,
      },
      replyTo: replyDraft
        ? {
            id: replyDraft.id,
            sender: { name: replyDraft.name },
            text: replyDraft.preview,
          }
        : null,
      reactions: [],
    };

    setMessagesByChatId((prev) => {
      const list = prev[cid] ?? [];
      return { ...prev, [cid]: [...list, optimistic] };
    });

    const lastMessage = String(text || "").trim() || "Sent an attachment";
    setChats((prev) =>
      bumpChat(prev, cid, (c) => ({
        ...c,
        lastMessage,
        time: formatTime(now),
        unread: 0,
      })),
    );

    sendWithRetry({
      conversationId: cid,
      text,
      files,
      gifAttachments,
      rawAttachments,
      tmpId,
      clientId,
      replyTo: replyDraft?.id || null,
    });
  };

  const onLogout = async () => {
    try {
      await AuthAPI.logout();
    } catch {
      // ignore
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
      // ignore
    }

    navigate("/auth", { replace: true });
  };

  const onProfile = () => setProfileOpen(true);
  const onCreateGroup = () => setCreateGroupOpen(true);

  const onSubmitCreateGroup = async ({ name, memberIds }) => {
    const res = await ChatAPI.createGroup({ name, memberIds });

    const newId = res.data?.conversation?.id;
    // reload list để mapper chạy đúng
    const meId = String(me?.id || "");
    await reloadConversations?.(meId);

    if (newId) {
      setActiveChatId(String(newId));
      setTab("chats");
    }
  };

  if (!me) {
    // ✅ Delete chat (hide conversation for me)

    return (
      <div className="w-full h-screen grid place-items-center bg-gradient-to-r from-[#b06ab3] to-[#4568dc]">
        <div className="px-4 py-3 text-white rounded-xl bg-black/20">
          Loading...
        </div>
      </div>
    );
  }

  const onLeaveGroup = async () => {
    if (!activeChatId || !me?.id) return;

    await ChatAPI.leaveGroup(String(activeChatId));
    setInfoOpen(false);
    setActiveChatId(null);
  };

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
            // mở chat => unread = 0
            setChats((prev) =>
              prev.map((c) => (c.id === String(id) ? { ...c, unread: 0 } : c)),
            );
          }}
          tab={tab}
          setTab={setTab}
          onLogout={onLogout}
          onProfile={onProfile}
          onFindFriend={() => setSearchOpen(true)}
          onCreateGroup={onCreateGroup}
          onMessageFriend={openChatWithFriend}
          notificationsOpen={noti.notiOpen}
          notificationsCount={noti.notiCount}
          notifications={noti.notiItems}
          onToggleNotifications={() => {
            const next = !noti.notiOpen;
            noti.setNotiOpen(next);
            if (next) {
              noti.markAllNotiRead();
              noti.loadIncomingRequests().catch(() => {});
            }
          }}
          onCloseNotifications={() => {
            noti.setNotiOpen(false);
          }}
          onAcceptRequest={(requestId) => noti.acceptRequest(requestId)}
          onRejectRequest={(requestId) => noti.rejectRequest(requestId)}
          onClearAllNotifications={() => noti.clearAll()}
          onDeleteChat={openDeleteModal}
          onViewProfile={(chat) => {
            const otherId =
              chat?.otherUserId ||
              chat?._raw?.members?.find?.(
                (m) => String(m.id) !== String(me?.id),
              )?.id;

            const seed = chat?._raw?.members?.find?.(
              (m) => String(m.id) === String(otherId),
            );

            openOtherProfile(otherId, seed);
          }}
          onReport={(chat) => console.log("Report chat", chat)}
        />

        <ChatWindow
          chat={activeChat}
          messages={messages}
          onSend={onSendText}
          onSendMessage={onSendMessage}
          onProfile={onProfile}
          otherOnline={activeOtherOnline}
          typingText={typingText}
          seenBy={seenBy}
          onTypingStart={(conversationId) => {
            const cid = conversationId
              ? String(conversationId)
              : activeChatId
                ? String(activeChatId)
                : null;
            if (!cid || !socket.connected) return;
            socket.emit("typing:start", {
              conversationId: cid,
              userId: String(me.id),
              name: me.name || "User",
            });
          }}
          onTypingStop={(conversationId) => {
            const cid = conversationId
              ? String(conversationId)
              : activeChatId
                ? String(activeChatId)
                : null;
            if (!cid || !socket.connected) return;
            socket.emit("typing:stop", {
              conversationId: cid,
              userId: String(me.id),
              name: me.name || "User",
            });
          }}
          isInfoOpen={infoOpen}
          onToggleInfo={() => setInfoOpen((v) => !v)}
          onChooseSticker={() => alert("Sticker picker: not implemented yet.")}
          onRetryMessage={(msg) => {
            const p = msg?.__retryPayload;
            if (!p) return;
            sendWithRetry({
              ...p,
              tmpId: msg.id,
              clientId: msg.clientId,
              replyTo: p.replyTo ?? null,
            });
          }}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={loadMore}
          isSearchOpen={isSearchOpen}
          onToggleSearch={() => setIsSearchOpen((v) => !v)}
          replyDraft={replyDraft}
          onReplySelect={onReplySelect}
          onClearReply={() => setReplyDraft(null)}
          onReactMessage={onReactMessage}
          onPinMessage={onPinMessage}
          onEditMessage={onEditMessage}
          onRecallMessage={onRecallMessage}
        />

        <GroupInfo
          chat={activeChat}
          groupInfo={groupInfo}
          open={infoOpen}
          onClose={() => setInfoOpen(false)}
          onOpenProfile={(userId, seed) => {
            // ✅ nếu click vào member trong group -> sẽ có userId truyền xuống
            if (userId) return openOtherProfile(String(userId), seed);

            // ✅ fallback: direct chat (click avatar trên top)
            const otherId = activeChat?.otherUserId;
            const seed2 = activeChat?._raw?.members?.find?.(
              (m) => String(m.id) === String(otherId),
            );
            openOtherProfile(otherId, seed2);
          }}
          onLeaveGroup={onLeaveGroup}
          onAddMember={onAddMember}
        />

        <SearchFriendModal
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          onPick={onPickAddMember}
          onSearchEmail={noti.searchUserByEmail}
          onSendRequest={noti.sendFriendRequest}
          onAccept={noti.acceptRequest}
          onReject={noti.rejectRequest}
        />

        <AddMemberModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          friends={friends} // ✅ list bạn bè của mày
          existingMemberIds={activeChat?._raw?.members?.map((m) => m.id) || []}
          onPick={onPickAddMember}
        />

        <CreateGroupModal
          open={createGroupOpen}
          onClose={() => setCreateGroupOpen(false)}
          friends={sortedFriends}
          onCreate={onSubmitCreateGroup}
        />

        {recallModal.open && (
          <div
            className="fixed inset-0 z-[100] grid place-items-center bg-black/40 backdrop-blur-[1px] p-4"
            onMouseDown={closeRecallModal}
          >
            <div
              className="w-full max-w-md p-5 bg-white shadow-xl rounded-2xl ring-1 ring-black/5"
              onMouseDown={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <p className="text-base font-semibold text-zinc-900">
                Can I recall the message?
              </p>
              <p className="mt-1 text-sm text-zinc-600">
                The message will be retracted for everyone in the conversation.
              </p>

              <div className="flex items-center justify-end gap-2 mt-5">
                <button
                  type="button"
                  className="h-10 px-4 border cursor-pointer rounded-xl border-zinc-200 hover:bg-zinc-50 disabled:opacity-50"
                  onClick={closeRecallModal}
                  disabled={recallModal.busy}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="h-10 px-4 text-white cursor-pointer rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50"
                  onClick={confirmRecallMessage}
                  disabled={recallModal.busy}
                >
                  Recall
                </button>
              </div>
            </div>
          </div>
        )}

        {editModal.open && (
          <div
            className="fixed inset-0 z-[100] grid place-items-center bg-black/40 backdrop-blur-[1px] p-4"
            onMouseDown={closeEditModal}
          >
            <div
              className="w-full max-w-md p-5 bg-white shadow-xl rounded-2xl ring-1 ring-black/5"
              onMouseDown={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <p className="text-base font-semibold text-zinc-900">
                Edit message
              </p>

              <textarea
                className="w-full mt-3 px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 min-h-[110px] resize-none"
                value={editModal.text}
                onChange={(e) =>
                  setEditModal((s) => ({ ...s, text: e.target.value, err: "" }))
                }
                disabled={editModal.busy}
              />

              {editModal.err ? (
                <div className="mt-2 text-sm text-rose-600">
                  {editModal.err}
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-2 mt-5">
                <button
                  type="button"
                  className="h-10 px-4 border cursor-pointer rounded-xl border-zinc-200 hover:bg-zinc-50 disabled:opacity-50"
                  onClick={closeEditModal}
                  disabled={editModal.busy}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="h-10 px-4 text-white cursor-pointer rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50"
                  onClick={confirmEditMessage}
                  disabled={editModal.busy}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {deleteModal.open && (
          <div
            className="fixed inset-0 z-[100] grid place-items-center bg-black/40 backdrop-blur-[1px] p-4"
            onMouseDown={closeDeleteModal} // click ra ngoài là đóng
          >
            <div
              className="w-full max-w-md p-5 bg-white shadow-xl rounded-2xl ring-1 ring-black/5"
              onMouseDown={(e) => e.stopPropagation()} // click trong box không đóng
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-start gap-3">
                <div className="grid w-10 h-10 rounded-xl bg-red-50 place-items-center">
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M3 6h18" />
                    <path d="M8 6V4h8v2" />
                    <path d="M6 6l1 16h10l1-16" />
                  </svg>
                </div>

                <div className="min-w-0">
                  <p className="text-base font-semibold text-zinc-900">
                    Delete the conversation?
                  </p>
                  <p className="mt-1 text-sm text-zinc-600">
                    You cannot undo the deletion of this conversation with
                  </p>
                  {deleteModal.chat?.name && (
                    <p className="mt-2 text-sm font-medium truncate text-zinc-900">
                      {deleteModal.chat.name}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-5">
                <button
                  type="button"
                  className="px-4 py-2 text-sm font-semibold border rounded-xl border-zinc-200 hover:bg-zinc-50"
                  onClick={closeDeleteModal}
                  disabled={deleteModal.busy}
                  autoFocus
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-60"
                  onClick={confirmDeleteChat}
                  disabled={deleteModal.busy}
                >
                  {deleteModal.busy ? "Deleting..." : "Delete chat"}
                </button>
              </div>
            </div>
          </div>
        )}

        <ProfileModal
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          me={me}
          setMe={setMe}
        />

        <UserProfileModal
          open={otherProfile.open}
          onClose={closeOtherProfile}
          userId={otherProfile.userId}
          seedUser={otherProfile.seedUser}
        />
      </div>
    </div>
  );
}
