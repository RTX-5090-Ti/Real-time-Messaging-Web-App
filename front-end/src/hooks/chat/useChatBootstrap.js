import { useEffect, useMemo, useRef, useState } from "react";
import { AuthAPI } from "../../api/auth.api.js";
import { ChatAPI } from "../../api/chat.api.js";
import {
  mapConversationsToChats,
  mapUsersToFriends,
} from "../../utils/chat/chatMappers.js";
import { avatarFromName, formatTimeOrDate } from "../../utils/chatUi.js";

export function useChatBootstrap({ navigate }) {
  const [me, setMe] = useState(null);

  const [chats, setChats] = useState([]);
  const [friends, setFriends] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messagesByChatId, setMessagesByChatId] = useState({});

  // presence
  const [onlineIds, setOnlineIds] = useState([]);
  const onlineSet = useMemo(() => new Set(onlineIds.map(String)), [onlineIds]);

  //  Sync friend status with live presence (avoid needing F5)
  useEffect(() => {
    setFriends((prev) => {
      let changed = false;

      const next = (prev || []).map((f) => {
        const nextStatus = onlineSet.has(String(f.id)) ? "online" : "offline";

        if (f?.status && f.status !== "online" && f.status !== "offline")
          return f;

        if (f.status === nextStatus) return f;

        changed = true;
        return { ...f, status: nextStatus };
      });

      return changed ? next : prev;
    });
  }, [onlineSet]);

  const onlineIdsRef = useRef([]);
  useEffect(() => {
    onlineIdsRef.current = onlineIds;
  }, [onlineIds]);

  const activeChatIdRef = useRef(null);
  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  // join tracking
  const joinedRoomRef = useRef(null);
  const joinedConvosRef = useRef(new Set());

  const reloadConversations = async (meId) => {
    const effectiveMeId = meId ? String(meId) : String(me?.id || "");
    if (!effectiveMeId) return { mapped: [], convos: [] };

    const convosRes = await ChatAPI.listConversations();
    const convos = convosRes.data?.conversations ?? [];
    const onlineNow = new Set((onlineIdsRef.current || []).map(String));

    const mapped = mapConversationsToChats({
      convos,
      meId: effectiveMeId,
      onlineIdsSet: onlineNow,
      avatarFromName,
      formatTimeOrDate,
    });

    setChats(mapped);

    return { mapped, convos };
  };

  // initial load: me + convos + users
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
          avatar: meData.avatarUrl || avatarFromName(meData.name),
          role: meData.role,
          email: meData.email,

          // profile
          gender: meData.gender || "",
          dob: meData.dob || "",
        };
        setMe(meUI);

        const [convosRes, friendsRes] = await Promise.all([
          ChatAPI.listConversations(),
          ChatAPI.listFriends(),
        ]);
        if (cancelled) return;

        const convos = convosRes.data?.conversations ?? [];
        const users = friendsRes.data?.friends ?? [];

        const onlineNow = new Set((onlineIdsRef.current || []).map(String));

        const mappedChats = mapConversationsToChats({
          convos,
          meId: meUI.id,
          onlineIdsSet: onlineNow,
          avatarFromName,
          formatTimeOrDate,
        });

        const mappedFriends = mapUsersToFriends({
          users,
          meId: meUI.id,
          onlineIdsSet: onlineNow,
          avatarFromName,
        });

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

  return {
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

    onlineIds,
    setOnlineIds,
    onlineSet,
    onlineIdsRef,

    joinedRoomRef,
    joinedConvosRef,

    reloadConversations,
  };
}
