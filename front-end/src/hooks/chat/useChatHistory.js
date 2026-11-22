import { fetchHistoryWindow } from "../../utils/chat/historySync.js";
import { useEffect, useRef, useState, useCallback } from "react";
import { ChatAPI } from "../../api/chat.api.js";
import { mapMessage, mergeMessages } from "../../utils/chat/messageState.js";
import { socket } from "../../socket/socket.js";

export function useChatHistory({ meId, activeChatId, setMessagesByChatId }) {
  const [pagingByCid, setPagingByCid] = useState({});
  const pagingRef = useRef({});
  const generation = useRef(0);
  const requests = useRef(new Set());
  const updatePaging = useCallback((cid, patch) => {
    pagingRef.current = { ...pagingRef.current, [cid]: { ...pagingRef.current[cid], ...patch } };
    setPagingByCid(pagingRef.current);
  }, []);

  useEffect(() => {
    const cid = activeChatId ? String(activeChatId) : "";
    if (!cid || !meId) return;
    let disposed = false;
    const invalidate = () => { generation.current++; };
    const refresh = async () => {
      const run = ++generation.current;
      const previous = pagingRef.current[cid];
      updatePaging(cid, { loadingInit: true, loadingMore: false });
      try {
        const data = await fetchHistoryWindow(
          async params => (await ChatAPI.getMessages(cid, params)).data,
          previous,
          () => !disposed && run === generation.current,
        );
        if (!data) return;
        setMessagesByChatId(prev => ({ ...prev, [cid]: mergeMessages(prev[cid] || [], data.messages.map(m => mapMessage(m, meId))) }));
        updatePaging(cid, { hasMore: data.hasMore, nextBefore: data.nextBefore,
          nextBeforeId: data.nextBeforeId, loadingInit: false, loadingMore: false });
      } catch (error) {
        if (!disposed && run === generation.current) {
          updatePaging(cid, { loadingInit: false });
          console.error("History sync failed", error);
        }
      }
    };
    refresh();
    socket.on("connect", refresh);
    return () => {
      disposed = true;
      invalidate();
      socket.off("connect", refresh);
    };
  }, [activeChatId, meId, setMessagesByChatId, updatePaging]);

  const loadMore = useCallback(async () => {
    const cid = String(activeChatId || "");
    const p = pagingRef.current[cid];
    if (!p?.hasMore || p.loadingInit || requests.current.has(cid)) return;
    requests.current.add(cid);
    const run = generation.current;
    updatePaging(cid, { loadingMore: true });
    try {
      const { data } = await ChatAPI.getMessages(cid, { limit: 30, before: p.nextBefore, beforeId: p.nextBeforeId });
      if (run !== generation.current) return;
      setMessagesByChatId(prev => ({ ...prev, [cid]: mergeMessages(prev[cid] || [], data.messages.map(m => mapMessage(m, meId))) }));
      updatePaging(cid, { hasMore: data.hasMore, nextBefore: data.nextBefore, nextBeforeId: data.nextBeforeId });
    } catch (error) { console.error("Load history failed", error); }
    finally {
      requests.current.delete(cid);
      if (run === generation.current) updatePaging(cid, { loadingMore: false });
    }
  }, [activeChatId, meId, setMessagesByChatId, updatePaging]);
  const paging = pagingByCid[String(activeChatId)] || {};
  return { hasMore: !!paging.hasMore, loadingMore: !!paging.loadingMore, loadMore };
}
