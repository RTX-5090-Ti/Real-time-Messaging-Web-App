import { useEffect, useMemo, useRef, useState } from "react";
import { AuthAPI } from "../../api/auth.api.js";
import { unauthenticated } from "../../api/sessionClient.js";
import { ChatAPI } from "../../api/chat.api.js";
import {
  mapConversationsToChats,
  mapUsersToFriends,
} from "../../utils/chat/chatMappers.js";
import { avatarFromName, formatTimeOrDate } from "../../utils/chatUi.js";

export function useChatBootstrap({ navigate }) {
  const [me, setMe] = useState(null);
  const [bootstrapError, setBootstrapError] = useState(false);
  const [bootstrapLoading, setBootstrapLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const retryBootstrap = () => {
    setBootstrapError(false);
    setBootstrapLoading(true);
    setAttempt(value => value + 1);
  };

  const [chats, setChats] = useState([]);
  const [friendProfiles, setFriends] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messagesByChatId, setMessagesByChatId] = useState({});

  // presence
  const [onlineIds, setOnlineIds] = useState([]);
  const onlineSet = useMemo(() => new Set(onlineIds.map(String)), [onlineIds]);

  // Presence is derived, never copied from a possibly stale HTTP response.
  const friends = useMemo(() => friendProfiles.map(friend => ({
    ...friend,
    status: onlineSet.has(String(friend.id)) ? "online" : "offline",
  })), [friendProfiles, onlineSet]);

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
        if (cancelled || e?.code === "STALE_SESSION") return;
        if (unauthenticated(e)) navigate("/auth", { replace: true });
        else setBootstrapError(true);
      } finally {
        if (!cancelled) setBootstrapLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  return {
    bootstrapError, bootstrapLoading, retryBootstrap,
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
