// src/components/chat/ChatWindow/useMessageListScroll.js
import { useEffect, useLayoutEffect, useRef, useState } from "react";

export function useMessageListScroll({
  chatId,
  messages,
  typingText,
  hasMore,
  loadingMore,
  onLoadMore,
}) {
  const listRef = useRef(null);
  const [newMsgCount, setNewMsgCount] = useState(0);

  const atBottomRef = useRef(true);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const lastLenRef = useRef(0);
  const firstIdRef = useRef(null);
  const lastIdRef = useRef(null);
  const pendingPrependRef = useRef(null);

  const isAtBottomfn = () => {
    const el = listRef.current;
    if (!el) return true;
    const threshold = 20;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distance <= threshold;
  };

  const scrollToBottom = (smooth = false) => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
  };

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;

    if (
      el.scrollTop <= 40 &&
      hasMore &&
      !loadingMore &&
      typeof onLoadMore === "function"
    ) {
      pendingPrependRef.current = { h: el.scrollHeight, t: el.scrollTop };
      onLoadMore();
    }

    requestAnimationFrame(() => {
      const atBottom = isAtBottomfn();
      atBottomRef.current = atBottom;
      setIsAtBottom(atBottom);
      if (atBottom) setNewMsgCount(0);
    });
  };

  useEffect(() => {
    if (typingText) {
      if (atBottomRef.current) scrollToBottom(false);
      return;
    }

    const curLen = messages.length;
    const prevLen = lastLenRef.current;

    const firstId = curLen ? messages[0]?.id : null;
    const lastId = curLen ? messages[curLen - 1]?.id : null;

    const wasFirst = firstIdRef.current;
    const wasLast = lastIdRef.current;
    const grew = curLen > prevLen;
    const isPrepend =
      grew && wasFirst && wasLast && firstId !== wasFirst && lastId === wasLast;

    lastLenRef.current = curLen;
    firstIdRef.current = firstId;
    lastIdRef.current = lastId;

    if (isPrepend) return;
    if (!grew) return;

    const last = messages[curLen - 1];
    const force = last?.from === "me";

    if (atBottomRef.current || force) {
      scrollToBottom(false);
      setNewMsgCount(0);
    } else {
      setNewMsgCount((n) => n + 1);
    }
  }, [messages, typingText]);

  useEffect(() => {
    requestAnimationFrame(() => {
      scrollToBottom(false);
      atBottomRef.current = true;
      setIsAtBottom(true);
      setNewMsgCount(0);
      lastLenRef.current = messages.length;
    });

    firstIdRef.current = messages[0]?.id ?? null;
    lastIdRef.current = messages[messages.length - 1]?.id ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  useLayoutEffect(() => {
    const el = listRef.current;
    const p = pendingPrependRef.current;
    if (!el || !p) return;
    const delta = el.scrollHeight - p.h;
    el.scrollTop = p.t + delta;
    pendingPrependRef.current = null;
  }, [messages?.length]);

  return {
    listRef,
    newMsgCount,
    setNewMsgCount,
    atBottomRef,
    isAtBottom,
    handleScroll,
    scrollToBottom,
  };
}
