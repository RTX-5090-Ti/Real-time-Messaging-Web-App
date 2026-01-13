// src/components/chat/ChatWindow/ChatWindow.jsx
import { useMemo, useEffect, useState } from "react";
import Composer from "../Composer.jsx";
import { useChatComposer } from "../useChatComposer.js";
import ChatWindowHeader from "./ChatWindowHeader.jsx";
import MessagesPane from "./MessagesPane.jsx";
import { useConversationSearch } from "./useConversationSearch.js";
import { useMessageListScroll } from "./useMessageListScroll.js";

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
  onPinMessage,
  onEditMessage,
  onRecallMessage,
}) {
  const title = chat?.name ?? "Messages";

  const subtitle = useMemo(() => {
    if (!chat) return null;
    return otherOnline ? "Online" : "Offline";
  }, [chat, otherOnline]);

  const {
    searchInput,
    setSearchInput,
    debouncedQuery,
    searchQuery,
    isSearching,
    matchIds,
    matchPos,
    setMatchPos,
    searchInputRef,
  } = useConversationSearch({
    isSearchOpen,
    chatId: chat?.id,
    messages,
  });

  const {
    listRef,
    newMsgCount,
    setNewMsgCount,
    atBottomRef,
    isAtBottom,
    handleScroll,
    scrollToBottom,
  } = useMessageListScroll({
    chatId: chat?.id,
    messages,
    typingText,
    hasMore,
    loadingMore,
    onLoadMore,
  });

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

  const jumpToMessage = async (id) => {
    const targetId = String(id || "");
    if (!targetId) return;

    const tryScroll = () => {
      const el = listRef.current?.querySelector?.(
        `[data-msg-id="${targetId}"]`
      );
      if (!el) return false;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      return true;
    };

    // đã có trong DOM -> nhảy luôn
    if (tryScroll()) return;

    // chưa có -> thử load thêm vài lần rồi nhảy
    const maxTries = 8;
    for (let i = 0; i < maxTries; i++) {
      if (!hasMore) break;
      try {
        await onLoadMore?.();
      } catch {
        break;
      }
      await new Promise((r) => requestAnimationFrame(r));
      if (tryScroll()) return;
    }
  };

  useEffect(() => {
    if (!isSearchOpen) return;
    if (!matchIds.length) return;

    const id = matchIds[matchPos];
    if (!id) return;

    const raf = requestAnimationFrame(() => {
      const el = listRef.current?.querySelector?.(`[data-msg-id="${id}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    return () => cancelAnimationFrame(raf);
  }, [isSearchOpen, matchIds, matchPos, listRef]);

  const [pinnedOpen, setPinnedOpen] = useState(false);

  const pinnedMessages = useMemo(() => {
    const list = Array.isArray(messages)
      ? messages.filter((m) => m?.pinned)
      : [];
    const ts = (m) => {
      const t = new Date(m?.pinnedAt || m?.createdAt || 0).getTime();
      return Number.isFinite(t) ? t : 0;
    };
    list.sort((a, b) => ts(b) - ts(a));
    return list;
  }, [messages]);

  const previewText = (m) => {
    if (!m) return "Tin nhắn";
    if (m.isRecalled) return "Đã thu hồi tin nhắn";
    const t = String(m.text || "").trim();
    if (t) return t;

    const att = m.attachments?.[0];
    if (!att) return "Tin nhắn";

    if (att.kind === "gif") return "[GIF]";
    if (att.kind === "sticker") return "[Sticker]";
    if (att.kind === "image") return "[Hình ảnh]";
    return "[Tệp]";
  };

  return (
    <main className="flex flex-col flex-1 min-w-0 bg-zinc-50">
      <ChatWindowHeader
        title={title}
        subtitle={subtitle}
        chat={chat}
        isSearchOpen={isSearchOpen}
        onToggleSearch={onToggleSearch}
        isInfoOpen={isInfoOpen}
        onToggleInfo={onToggleInfo}
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        searchInputRef={searchInputRef}
        isSearching={isSearching}
        debouncedQuery={debouncedQuery}
        matchIds={matchIds}
        matchPos={matchPos}
        setMatchPos={setMatchPos}
      />

      {chat && pinnedMessages.length > 0 && (
        <div className="px-4 py-2 bg-white border-b shrink-0 border-zinc-200">
          <div className="flex items-center min-w-0 gap-2">
            <span className="text-zinc-500">📌</span>

            {/* click snippet -> jump */}
            <button
              type="button"
              className="min-w-0 text-sm text-left truncate cursor-pointer text-zinc-800 hover:underline"
              title="Nhảy tới tin đã ghim"
              onClick={() => jumpToMessage(pinnedMessages[0].id)}
            >
              {previewText(pinnedMessages[0])}
            </button>

            {pinnedMessages.length > 1 && (
              <button
                type="button"
                className="ml-auto text-sm font-medium cursor-pointer text-violet-700 hover:underline"
                onClick={() => setPinnedOpen(true)}
                title="Xem tất cả tin đã ghim"
              >
                Xem {pinnedMessages.length} tin
              </button>
            )}
          </div>

          {/* Modal list pinned */}
          {pinnedOpen && (
            <div
              className="fixed inset-0 z-[90] grid place-items-center bg-black/40 backdrop-blur-[1px] p-4"
              onMouseDown={() => setPinnedOpen(false)}
            >
              <div
                className="w-full max-w-md overflow-hidden bg-white shadow-xl rounded-2xl ring-1 ring-black/5"
                onMouseDown={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
              >
                <div className="flex items-center justify-between px-4 border-b h-14 border-zinc-200">
                  <div className="font-semibold text-zinc-900">
                    Tin nhắn đã ghim
                  </div>
                  <button
                    type="button"
                    className="grid cursor-pointer w-9 h-9 rounded-xl place-items-center hover:bg-zinc-100"
                    onClick={() => setPinnedOpen(false)}
                    title="Đóng"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-2 max-h-[60vh] overflow-auto">
                  {pinnedMessages.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className="w-full px-3 py-2 text-sm text-left cursor-pointer rounded-xl hover:bg-zinc-50"
                      onClick={() => {
                        setPinnedOpen(false);
                        jumpToMessage(m.id);
                      }}
                      title="Nhảy tới tin nhắn"
                    >
                      <div className="truncate text-zinc-900">
                        {previewText(m)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <MessagesPane
        listRef={listRef}
        handleScroll={handleScroll}
        chat={chat}
        messages={messages}
        hasMore={hasMore}
        loadingMore={loadingMore}
        searchQuery={searchQuery}
        matchIds={matchIds}
        matchPos={matchPos}
        seenBy={seenBy}
        seenKey={seenKey}
        showTypingBubble={showTypingBubble}
        onRetryMessage={onRetryMessage}
        onReplySelect={onReplySelect}
        onReactMessage={onReactMessage}
        jumpToMessage={jumpToMessage}
        scrollToBottom={scrollToBottom}
        newMsgCount={newMsgCount}
        setNewMsgCount={setNewMsgCount}
        atBottomRef={atBottomRef}
        isAtBottom={isAtBottom}
        onPinMessage={onPinMessage}
        onEditMessage={onEditMessage}
        onRecallMessage={onRecallMessage}
      />

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
