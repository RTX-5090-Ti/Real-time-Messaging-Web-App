// src/components/chat/ChatWindow/MessagesPane.jsx
import { MessageBubble } from "../MessageBubble.jsx";
import TypingIndicator from "../TypingIndicator.jsx";
import SeenByRow from "./SeenByRow.jsx";
import NewMessagesToast from "./NewMessagesToast.jsx";

export default function MessagesPane({
  listRef,
  handleScroll,
  chat,
  messages,
  hasMore,
  loadingMore,

  searchQuery,
  matchIds,
  matchPos,

  seenBy,
  seenKey,
  showTypingBubble,
  typingText,

  onRetryMessage,
  onReplySelect,
  onReactMessage,
  jumpToMessage,

  scrollToBottom,
  newMsgCount,
  setNewMsgCount,
  atBottomRef,
  isAtBottom,
  onPinMessage,
  onEditMessage,
  onRecallMessage,
}) {
  const handleMediaLoad = () => {
    if (atBottomRef.current) scrollToBottom(false);
  };

  return (
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
            const isGroup = String(chat?.type || "direct") === "group";
            const prev = messages[idx - 1];
            const prevSenderId = prev?.senderId ? String(prev.senderId) : null;
            const curSenderId = m?.senderId ? String(m.senderId) : null;

            // ✅ Group: show sender name only when sender changes (and not my own messages)
            const isRealOther = m?.from === "other";

            const showSenderName =
              isGroup &&
              isRealOther &&
              (curSenderId
                ? curSenderId !== prevSenderId
                : String(m?.name || "") !== String(prev?.name || ""));

            const q = (searchQuery || "").toLowerCase();
            const isMatch =
              !!q &&
              String(m?.text || "")
                .toLowerCase()
                .includes(q);
            const isHit = !!searchQuery && matchIds[matchPos] === m.id;
            const isLast = idx === messages.length - 1;
            const showSeen =
              isLast && m.from === "me" && (seenBy?.length ?? 0) > 0;

            return (
              <div key={m.id} data-msg-id={m.id} className="space-y-1">
                <MessageBubble
                  msg={m}
                  showSenderName={showSenderName}
                  onMediaLoad={handleMediaLoad}
                  onRetry={onRetryMessage}
                  highlightQuery={searchQuery}
                  isSearchMatch={isMatch}
                  isSearchHit={isHit}
                  onReply={() => onReplySelect?.(m)}
                  onReact={(emoji) => onReactMessage?.(m.id, emoji)}
                  onJumpTo={jumpToMessage}
                  onPin={() => onPinMessage?.(m.id)}
                  onEdit={() => onEditMessage?.(m)}
                  onRecall={() => onRecallMessage?.(m.id)}
                />

                {showSeen ? (
                  <SeenByRow seenKey={seenKey} seenBy={seenBy} />
                ) : null}
              </div>
            );
          })}

          <TypingIndicator
            show={showTypingBubble}
            avatar={chat.avatar}
            name={chat.name}
            text={typingText}
          />
        </>
      ) : (
        <div className="grid h-full place-items-center text-zinc-500">
          Select a chat to start
        </div>
      )}

      <NewMessagesToast
        newMsgCount={newMsgCount > 0 && !isAtBottom ? newMsgCount : 0}
        onClick={() => {
          scrollToBottom(true);
          setNewMsgCount(0);
        }}
      />
    </div>
  );
}
