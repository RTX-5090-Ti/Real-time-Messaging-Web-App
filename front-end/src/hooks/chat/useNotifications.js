import { useEffect, useMemo, useRef, useState } from "react";
import { ChatAPI } from "../../api/chat.api.js";
import {
  countUnread,
  keyOfNoti,
  loadNotiFromLS,
  saveNotiToLS,
} from "../../utils/chat/chatPageHelpers.js";
import { avatarFromName } from "../../utils/chatUi.js";

export function useNotifications({ me, onlineSet, setFriends }) {
  const [notiOpen, setNotiOpen] = useState(false);
  const [notiItems, setNotiItems] = useState([]);
  const [notiCount, setNotiCount] = useState(0);

  const notiOpenRef = useRef(false);

  useEffect(() => {
    notiOpenRef.current = notiOpen;
  }, [notiOpen]);

  const makeUser = (u) =>
    u
      ? {
          id: String(u.id || u._id || ""),
          name: u.name || "User",
          email: u.email || "",
          avatarUrl: u.avatarUrl || null,
          avatar: u.avatarUrl || u.avatar || avatarFromName(u.name || "User"),
        }
      : null;

  const loadFriends = async () => {
    const { data } = await ChatAPI.listFriends();
    const list = (data.friends || []).map((u) => ({
      id: String(u.id),
      name: u.name,
      email: u.email,
      avatarUrl: u.avatarUrl || null,
      avatar: u.avatarUrl || avatarFromName(u.name),
      status: onlineSet.has(String(u.id)) ? "online" : "offline",
    }));
    setFriends(list);
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
          avatarUrl: r.from.avatarUrl || null,
          avatar: r.from.avatarUrl || avatarFromName(r.from.name),
        },
        createdAt: r.createdAt,
      }));

    setNotiItems((prev) => {
      const prevMap = new Map(prev.map((n) => [keyOfNoti(n), n]));

      const keep = prev.filter((n) => n.type !== "friend_request");

      const mergedRaw = [...reqItems, ...keep].filter((n, idx, arr) => {
        const k = keyOfNoti(n);
        return idx === arr.findIndex((x) => keyOfNoti(x) === k);
      });

      const merged = mergedRaw.map((n) => ({
        ...n,
        readAt: prevMap.get(keyOfNoti(n))?.readAt ?? null,
      }));

      setNotiCount(notiOpenRef.current ? 0 : countUnread(merged));
      return merged;
    });
  };

  const markAllNotiRead = () => {
    const now = new Date().toISOString();
    setNotiItems((prev) => {
      const next = prev.map((n) => (n.readAt ? n : { ...n, readAt: now }));
      setNotiCount(0);
      return next;
    });
  };

  const pushSelfFriendActionNoti = (requestId, fromUser, action) => {
    if (!me?.id) return;

    const now = new Date().toISOString();
    const type =
      action === "accepted"
        ? "friend_request_accepted_self"
        : "friend_request_rejected_self";

    const item = {
      id: `self:${type}:${requestId}:${Date.now()}`,
      requestId: String(requestId),
      type,
      createdAt: now,
      readAt: now, // bấm xong coi như đã đọc
      from: fromUser ? { ...fromUser } : null,
      by: {
        id: String(me.id),
        name: "You",
        email: me.email || "",
        avatar: me.avatar || avatarFromName(me.name),
      },
    };

    setNotiItems((prev) => {
      // remove pending request item
      const filtered = prev.filter(
        (n) =>
          !(
            n.type === "friend_request" &&
            String(n.requestId) === String(requestId)
          ),
      );

      const exists = filtered.some((n) => keyOfNoti(n) === keyOfNoti(item));
      const next = exists ? filtered : [item, ...filtered];

      setNotiCount(notiOpenRef.current ? 0 : countUnread(next));
      return next;
    });
  };

  const acceptRequest = async (requestId) => {
    const req = notiItems.find(
      (n) =>
        n.type === "friend_request" &&
        String(n.requestId) === String(requestId),
    );
    const fromUser = req?.from || null;

    await ChatAPI.acceptRequest(requestId);
    pushSelfFriendActionNoti(requestId, fromUser, "accepted");

    await Promise.all([loadFriends(), loadIncomingRequests()]);
  };

  const rejectRequest = async (requestId) => {
    const req = notiItems.find(
      (n) =>
        n.type === "friend_request" &&
        String(n.requestId) === String(requestId),
    );
    const fromUser = req?.from || null;

    await ChatAPI.rejectRequest(requestId);
    pushSelfFriendActionNoti(requestId, fromUser, "rejected");

    await loadIncomingRequests();
  };

  const sendFriendRequest = async (toUserId) => {
    await ChatAPI.sendFriendRequest(toUserId);
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
              avatarUrl: data.user.avatarUrl || null,
              avatar: data.user.avatarUrl || avatarFromName(data.user.name),
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
      if (e?.response?.status === 404) {
        return { user: null, relationship: "none" };
      }
      const msg = e?.response?.data?.message || e?.message || "Search failed";
      throw new Error(msg);
    }
  };

  const onNotificationNew = (payload) => {
    const type = payload?.type;
    if (!type) return;

    const data = payload?.data || null;

    const item = {
      id: String(payload.id || payload.requestId || Date.now()),
      requestId: payload.requestId ? String(payload.requestId) : null,
      type,
      createdAt: payload.createdAt || new Date().toISOString(),
      data, // ✅ giữ data để dropdown đọc conversationName
      from: makeUser(payload.from || data?.from),
      by: makeUser(payload.by || data?.by),
      readAt: notiOpenRef.current ? new Date().toISOString() : null,
    };

    setNotiItems((prev) => {
      // chống duplicate
      if (
        prev.some(
          (x) =>
            x.type === item.type &&
            x.requestId &&
            x.requestId === item.requestId,
        )
      ) {
        return prev;
      }

      const next = [item, ...prev];
      setNotiCount(notiOpenRef.current ? 0 : countUnread(next));
      return next;
    });

    // nếu đang mở dropdown thì sync pending từ server
    if (type === "friend_request" && notiOpenRef.current) {
      loadIncomingRequests().catch(() => {});
    }

    // accepted => reload friends
    if (type === "friend_request_accepted") {
      loadFriends().catch(() => {});
    }
  };

  // F5 vẫn giữ noti
  useEffect(() => {
    if (!me?.id) return;

    const cached = loadNotiFromLS(me.id);
    setNotiItems(cached);
    setNotiCount(notiOpenRef.current ? 0 : countUnread(cached));

    loadFriends().catch(() => {});
    loadIncomingRequests().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  useEffect(() => {
    if (!me?.id) return;
    saveNotiToLS(me.id, notiItems);
  }, [me?.id, notiItems]);

  const api = useMemo(
    () => ({
      loadFriends,
      loadIncomingRequests,
      markAllNotiRead,
      acceptRequest,
      rejectRequest,
      sendFriendRequest,
      searchUserByEmail,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [me?.id, onlineSet, notiItems],
  );

  return {
    notiOpen,
    setNotiOpen,

    notiItems,
    notiCount,

    notiOpenRef,

    onNotificationNew,

    ...api,

    clearAll: () => {
      setNotiItems([]);
      setNotiCount(0);
    },
  };
}
