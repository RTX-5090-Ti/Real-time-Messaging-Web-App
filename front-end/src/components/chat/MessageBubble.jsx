// src/components/chat/MessageBubble.jsx
import { useState } from "react";
import { HighlightedText } from "./HighlightedText";
import { MessageActionBar } from "./MessageActionBar";
import { MessageReplyPreview } from "./MessageReplyPreview";
import { MessageAttachments } from "./MessageAttachments";
import { MessageMeta } from "./MessageMeta";
import { MessageReactionsLine } from "./MessageReactionsLine";

export function MessageBubble({
  msg,
  showSenderName = false,
  onMediaLoad,
  onRetry,
  highlightQuery = "",
  isSearchMatch = false,
  isSearchHit = false,
  onReply,
  onReact,
  onJumpTo,
  onPin,
  onEdit,
  onRecall,
}) {
  const mine = msg.from === "me";
  const attachments = Array.isArray(msg.attachments) ? msg.attachments : [];

  const [openReact, setOpenReact] = useState(false);
  const [openMore, setOpenMore] = useState(false);

  const reactions = Array.isArray(msg.reactions) ? msg.reactions : [];
  const reactionCounts = reactions.reduce((acc, r) => {
    const e = r?.emoji;
    if (!e) return acc;
    acc[e] = (acc[e] || 0) + 1;
    return acc;
  }, {});
  const reactionLine = Object.entries(reactionCounts)
    .map(([e, n]) => `${e}${n > 1 ? ` ${n}` : ""}`)
    .join("  ");

  // Bubble classes
  const bubbleClass = [
    "rounded-2xl px-4 py-3 ring-1 break-words",
    mine
      ? "bg-violet-600 text-white ring-violet-300"
      : "bg-white text-zinc-900 ring-zinc-200",
    isSearchMatch ? "ring-2 ring-yellow-500 shadow-sm" : "",
    isSearchHit ? "ring-2 ring-yellow-500 shadow-sm" : "",
  ].join(" ");

  /**
   * Mục tiêu:
   * - wrapClass chiếm full ngang để hover “ăn” cả hàng
   * - action bar nằm cạnh bubble => không che bubble
   * - tránh scroll ngang: bubble max-w phải trừ đi width action bar
   */
  const wrapClass = ["group relative w-full flex-1 min-w-0"].join(" ");

  const rowClass = [
    "flex items-center gap-2 w-full max-w-full",
    mine ? "justify-end" : "justify-start",
  ].join(" ");

  // IMPORTANT: bubble + actionbar phải fit trong 100% => trừ ~88px (2 nút + gap)
  const bubbleWrapClass = "min-w-0 max-w-[calc(70%-88px)]";

  const actionBarClass = [
    "z-30 flex items-center gap-2 shrink-0",
    openReact || openMore
      ? "opacity-100 pointer-events-auto"
      : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto",
    "transition",
  ].join(" ");

  const replyId = msg?.replyTo?.id || msg?.replyTo?._id;

  const isSystem = msg?.kind === "system" || msg?.from === "system";
  if (isSystem) {
    return (
      <div className="flex justify-center w-full py-2">
        <div className="px-3 py-1 text-xs rounded-full bg-zinc-100 text-zinc-500">
          {msg.text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full">
      {!mine ? (
        <img
          src={msg.avatarUrl || msg.avatar}
          alt={msg.name}
          className="object-cover mt-1 mr-3 rounded-full w-9 h-9 shrink-0"
        />
      ) : null}

      {/* container còn lại chiếm full để hover “ăn” cả hàng */}
      <div
        className={[
          "flex-1 min-w-0 flex",
          mine ? "justify-end" : "justify-start",
        ].join(" ")}
      >
        <div className={wrapClass}>
          {/* Row: action bar <-> bubble (không overlay) */}
          <div className={rowClass}>
            {/* mine => action bar nằm bên TRÁI bubble */}
            {mine ? (
              <MessageActionBar
                mine={mine}
                pinned={!!msg.pinned}
                openReact={openReact}
                setOpenReact={setOpenReact}
                openMore={openMore}
                setOpenMore={setOpenMore}
                actionBarClass={actionBarClass}
                onReply={() => onReply?.()}
                onReact={(e) => onReact?.(e)}
                onPin={() => onPin?.()}
                onEdit={() => onEdit?.()}
                onRecall={() => onRecall?.()}
              />
            ) : null}

            <div className={bubbleWrapClass}>
              {/* Group chat: show sender name (only for other people) */}
              {!mine && showSenderName && msg?.name ? (
                <div className="pl-1 mb-1 text-xs font-semibold select-none text-zinc-500">
                  {msg.name}
                </div>
              ) : null}
              <div className={bubbleClass}>
                {msg?.pinned ? (
                  <div
                    className={[
                      "mb-1 flex",
                      mine ? "justify-end" : "justify-start",
                    ].join(" ")}
                    title="Pinned message"
                  >
                    <span
                      className={[
                        "inline-flex items-center text-xs font-semibold select-none",
                        mine ? "text-violet-200" : "text-zinc-500",
                      ].join(" ")}
                      aria-label="Pinned"
                    >
                      📌
                    </span>
                  </div>
                ) : null}

                {/* Reply preview nằm TRONG bubble */}
                <MessageReplyPreview
                  mine={mine}
                  replyTo={msg.replyTo}
                  replyId={replyId}
                  onJumpTo={onJumpTo}
                />

                {msg.text ? (
                  <p className="text-sm leading-relaxed">
                    <HighlightedText
                      text={msg.text}
                      query={highlightQuery}
                      mine={mine}
                    />
                  </p>
                ) : null}

                <MessageAttachments
                  mine={mine}
                  msgImage={msg.image}
                  attachments={attachments}
                  onMediaLoad={onMediaLoad}
                />

                <MessageMeta mine={mine} msg={msg} onRetry={onRetry} />
              </div>
            </div>

            {/* not mine => action bar nằm bên PHẢI bubble */}
            {!mine ? (
              <MessageActionBar
                mine={mine}
                pinned={!!msg.pinned}
                openReact={openReact}
                setOpenReact={setOpenReact}
                openMore={openMore}
                setOpenMore={setOpenMore}
                actionBarClass={actionBarClass}
                onReply={() => onReply?.()}
                onReact={(e) => onReact?.(e)}
                onPin={() => onPin?.()}
                // onEdit={() => onEdit?.()}
                // onRecall={() => onRecall?.()}
              />
            ) : null}
          </div>

          {/* reactions dưới bubble */}
          <MessageReactionsLine mine={mine} reactionLine={reactionLine} />
        </div>
      </div>
    </div>
  );
}
