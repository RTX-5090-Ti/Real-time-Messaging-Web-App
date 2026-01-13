import { useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import { MessageBubble } from "./MessageBubble.jsx";
import TypingIndicator from "./TypingIndicator.jsx";
import Composer from "./Composer.jsx";
import { useChatComposer } from "./useChatComposer.js";

function Icon({ children, tooltip, onClick, active }) {
  return (
    <div className="relative">
      <span className="inline-flex group">
        <button
          type="button"
          onClick={onClick}
          className={[
            "inline-flex items-center justify-center transition cursor-pointer h-10 w-10 rounded-xl",
            active ? "bg-violet-50 text-violet-700" : "hover:bg-zinc-100",
          ].join(" ")}
          aria-pressed={!!active}
          title={tooltip}
        >
          {children}
        </button>
      </span>
    </div>
  );
}

export default function ChatWindow({
  chat,
  messages = [],
  hasMore,
  loadingMore,
  onLoadMore,
  onSend,
  onSendMessage,
  isSearchOpen = false,
  onToggleSearch,
  // onProfile,
  isInfoOpen,
  onToggleInfo,
  otherOnline = false,
  typingText = null,
  seenBy = [],
  onTypingStart,
  onTypingStop,
  onChooseSticker,
  onRetryMessage,
  replyDraft,
  onReplySelect,
  onClearReply,
  onReactMessage,
}) {
  const title = chat?.name ?? "Messages";
  const listRef = useRef(null);
  const [newMsgCount, setNewMsgCount] = useState(0);
  // ===== Search in conversation =====
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [matchIds, setMatchIds] = useState([]);
  const [matchPos, setMatchPos] = useState(0);
  const atBottomRef = useRef(true);
  const lastLenRef = useRef(0);
  const firstIdRef = useRef(null);
  const lastIdRef = useRef(null);

  const pendingPrependRef = useRef(null);
  const searchInputRef = useRef(null);
  useEffect(() => {
    if (!isSearchOpen) return;
    const raf = requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [isSearchOpen, chat?.id]);

  // 1–2s debounce (mày thích 1.2s thì đổi 1200)
  useEffect(() => {
    if (!isSearchOpen) return;
    const t = setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
    }, 500);
    return () => clearTimeout(t);
  }, [searchInput, isSearchOpen]);

  // reset khi tắt search hoặc đổi chat
  useEffect(() => {
    if (!isSearchOpen) {
      setSearchInput("");
      setDebouncedQuery("");
      setMatchIds([]);
      setMatchPos(0);
    }
  }, [isSearchOpen]);

  useEffect(() => {
    setSearchInput("");
    setDebouncedQuery("");
    setMatchIds([]);
    setMatchPos(0);
  }, [chat?.id]);

  const searchQuery = isSearchOpen ? debouncedQuery : "";
  const isSearching = isSearchOpen && searchInput.trim() !== debouncedQuery;

  // compute matches
  useEffect(() => {
    const q = searchQuery.toLowerCase();
    if (!q) {
      setMatchIds([]);
      setMatchPos(0);
      return;
    }

    const ids = (messages || [])
      .filter((m) =>
        String(m?.text || "")
          .toLowerCase()
          .includes(q)
      )
      .map((m) => m.id);

    setMatchIds(ids);
    setMatchPos(ids.length ? ids.length - 1 : 0);
  }, [messages, searchQuery]);

  // scroll tới match hiện tại
  useEffect(() => {
    if (!isSearchOpen) return;
    if (!matchIds.length) return;

    const id = matchIds[Math.min(matchPos, matchIds.length - 1)];

    requestAnimationFrame(() => {
      const el = listRef.current?.querySelector?.(`[data-msg-id="${id}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [matchIds, matchPos, isSearchOpen]);

  const isAtBottom = () => {
    const el = listRef.current;
    if (!el) return true;
    const threshold = 20; // px
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distance <= threshold;
  };

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;

    // ✅ near top => load more
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
      const atBottom = isAtBottom();
      atBottomRef.current = atBottom;
      if (atBottom) setNewMsgCount(0);
    });
  };

  const scrollToBottom = (smooth = false) => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
  };

  // auto scroll on new messages / typing bubble
  useEffect(() => {
    // Typing bubble: chỉ scroll nếu đang ở cuối
    if (typingText) {
      if (atBottomRef.current) scrollToBottom(false);
      return;
    }

    const curLen = messages.length;
    const prevLen = lastLenRef.current;

    const firstId = curLen ? messages[0]?.id : null;
    const lastId = curLen ? messages[curLen - 1]?.id : null;

    // ✅ Detect prepend (load older): firstId đổi, lastId giữ nguyên, length tăng
    const wasFirst = firstIdRef.current;
    const wasLast = lastIdRef.current;
    const grew = curLen > prevLen;
    const isPrepend =
      grew && wasFirst && wasLast && firstId !== wasFirst && lastId === wasLast;

    // update refs
    lastLenRef.current = curLen;
    firstIdRef.current = firstId;
    lastIdRef.current = lastId;

    // ✅ nếu là prepend => giữ nguyên vị trí, KHÔNG auto-scroll
    if (isPrepend) return;

    // append new message
    if (!grew) return;

    const last = messages[curLen - 1];
    const force = last?.from === "me"; // mình gửi thì luôn kéo xuống

    if (atBottomRef.current || force) {
      scrollToBottom(false);
      setNewMsgCount(0);
    } else {
      setNewMsgCount((n) => n + 1);
    }
  }, [messages, typingText]);

  useEffect(() => {
    // switch conversation -> về cuối
    requestAnimationFrame(() => {
      scrollToBottom(false);
      atBottomRef.current = true;
      setNewMsgCount(0);
      lastLenRef.current = messages.length;
    });
    firstIdRef.current = messages[0]?.id ?? null;
    lastIdRef.current = messages[messages.length - 1]?.id ?? null;

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat?.id]);

  const subtitle = useMemo(() => {
    if (!chat) return null;
    return otherOnline ? "Online" : "Offline";
  }, [chat, otherOnline]);

  // ✅ sau khi prepend xong => giữ nguyên khung đang nhìn
  useLayoutEffect(() => {
    const el = listRef.current;
    const p = pendingPrependRef.current;
    if (!el || !p) return;
    const delta = el.scrollHeight - p.h;
    el.scrollTop = p.t + delta;
    pendingPrependRef.current = null;
  }, [messages?.length]);

  // Seen animation
  const seenKey = useMemo(
    () => (seenBy || []).map((x) => x.id).join(","),
    [seenBy]
  );

  const showTypingBubble = !!chat && !!typingText;

  const composer = useChatComposer({
    chat,
    onSend: (text) => {
      onSend?.(text);
      onClearReply?.();
    },
    onSendMessage: async (payload) => {
      await onSendMessage?.(payload);
      onClearReply?.();
    },
    onTypingStart,
    onTypingStop,
  });

  const jumpToMessage = (id) => {
    const targetId = String(id || "");
    if (!targetId) return;
    const el = listRef.current?.querySelector(`[data-msg-id="${targetId}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <main className="flex flex-col flex-1 min-w-0 bg-zinc-50">
      {/* Header */}
      <div className="flex items-center justify-between h-16 px-5 bg-white border-b border-zinc-200">
        <div className="min-w-0">
          <p className="font-semibold truncate text-zinc-900">{title}</p>
          {chat ? <p className="text-xs text-zinc-500">{subtitle}</p> : null}
        </div>

        <div className="flex items-center gap-2">
          <Icon
            tooltip="Search messages"
            onClick={onToggleSearch}
            active={isSearchOpen}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle
                cx="11"
                cy="11"
                r="7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M20 20l-3.5-3.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </Icon>

          <Icon
            tooltip="Conversation info"
            onClick={onToggleInfo}
            active={isInfoOpen}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 17v-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M12 7h.01"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <path
                d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
          </Icon>

          {isSearchOpen && chat ? (
            <div
              className={[
                "bg-white overflow-hidden",
                "transition-[max-height,opacity,transform] duration-200 ease-out",
                isSearchOpen
                  ? "max-h-16 opacity-100 translate-y-0"
                  : "max-h-0 opacity-0 -translate-y-1",
              ].join(" ")}
            >
              <div className="flex items-center gap-2">
                <input
                  value={searchInput}
                  ref={searchInputRef}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search within a conversation"
                  className="flex-1 h-10 px-3 text-sm border outline-none min-w-100 rounded-xl border-zinc-200 focus:ring-2 focus:ring-violet-200"
                  autoFocus
                />

                <div className="shrink-0 w-[60px] text-center text-xs text-zinc-500">
                  {isSearching
                    ? "Searching…"
                    : !debouncedQuery
                    ? ""
                    : matchIds.length
                    ? `${matchPos + 1}/${matchIds.length}`
                    : "No results"}
                </div>

                <button
                  type="button"
                  className="flex items-center justify-center h-10 gap-2 px-3 text-sm border cursor-pointer group rounded-xl border-zinc-200 hover:bg-zinc-50 disabled:opacity-50"
                  onClick={() =>
                    setMatchPos((p) =>
                      matchIds.length
                        ? (p - 1 + matchIds.length) % matchIds.length
                        : 0
                    )
                  }
                  disabled={!matchIds.length}
                  title="Previous"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    className={
                      matchIds.length
                        ? "text-violet-600 group-hover:text-violet-700"
                        : "text-zinc-400"
                    }
                    aria-hidden="true"
                  >
                    <path
                      d="M12 5l-6 6m6-6l6 6M12 5v14"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>

                <button
                  type="button"
                  className="flex items-center justify-center h-10 gap-2 px-3 text-sm border cursor-pointer group rounded-xl border-zinc-200 hover:bg-zinc-50 disabled:opacity-50"
                  onClick={() =>
                    setMatchPos((p) =>
                      matchIds.length ? (p + 1) % matchIds.length : 0
                    )
                  }
                  disabled={!matchIds.length}
                  title="Next"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    className={
                      matchIds.length
                        ? "text-violet-600 group-hover:text-violet-700"
                        : "text-zinc-400"
                    }
                    aria-hidden="true"
                  >
                    <path
                      d="M12 19l6-6m-6 6l-6-6M12 19V5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="relative flex-1 p-6 space-y-5 overflow-x-hidden overflow-y-auto"
      >
        {chat && (hasMore || loadingMore) ? (
          <div className="py-2 text-xs text-center text-zinc-500">
            {loadingMore ? "Loading..." : "Scroll up to load more"}
          </div>
        ) : null}
        {chat ? (
          <>
            {messages.map((m, idx) => {
              const isHit = !!searchQuery && matchIds[matchPos] === m.id;
              const isLast = idx === messages.length - 1;
              const showSeen =
                isLast && m.from === "me" && (seenBy?.length ?? 0) > 0;

              return (
                <div key={m.id} data-msg-id={m.id} className="space-y-1">
                  <MessageBubble
                    msg={m}
                    onMediaLoad={scrollToBottom}
                    onRetry={onRetryMessage}
                    highlightQuery={searchQuery}
                    isSearchHit={isHit} // đổi đúng tên prop luôn
                    onReply={() => onReplySelect?.(m)}
                    onReact={(emoji) => onReactMessage?.(m.id, emoji)}
                    onJumpTo={jumpToMessage}
                  />

                  {showSeen ? (
                    <div className="flex justify-end mt-[10px]">
                      <div
                        key={seenKey}
                        className="flex items-center gap-2 pr-2 animate-[fadeInUp_.18s_ease-out]"
                      >
                        <div className="flex -space-x-2">
                          {seenBy.slice(0, 3).map((u) => (
                            <img
                              key={u.id}
                              src={u.avatar}
                              alt={u.name}
                              title={`Seen by ${u.name}`}
                              className="object-cover w-5 h-5 rounded-full shadow-sm ring-2 ring-white"
                            />
                          ))}
                          {seenBy.length > 3 ? (
                            <span className="grid w-5 h-5 text-[10px] font-semibold bg-white rounded-full ring-2 ring-white shadow-sm place-items-center text-zinc-600">
                              +{seenBy.length - 3}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}

            <TypingIndicator
              show={showTypingBubble}
              avatar={chat.avatar}
              name={chat.name}
            />
          </>
        ) : (
          <div className="grid h-full place-items-center text-zinc-500">
            Select a chat to start
          </div>
        )}

        {newMsgCount > 0 && !atBottomRef.current && (
          <div className="sticky z-50 flex justify-center pointer-events-none bottom-4">
            <button
              type="button"
              onClick={() => {
                scrollToBottom(true);
                setNewMsgCount(0);
                atBottomRef.current = true;
              }}
              className="pointer-events-auto px-3 py-1.5 text-sm rounded-full bg-zinc-900 text-white shadow cursor-pointer"
            >
              New messages ({newMsgCount})
            </button>
          </div>
        )}
      </div>

      {/* Composer */}
      <Composer
        chat={chat}
        onChooseSticker={onChooseSticker}
        replyDraft={replyDraft}
        onCancelReply={onClearReply}
        {...composer}
      />
    </main>
  );
}
