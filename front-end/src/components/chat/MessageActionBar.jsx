import { useEffect, useRef } from "react";

export function MessageActionBar({
  mine,
  pinned = false,

  openReact,
  setOpenReact,

  openMore,
  setOpenMore,

  onReply,
  onReact,

  onPin,
  onEdit,
  onRecall,

  actionBarClass,
}) {
  const moreWrapRef = useRef(null);

  // click ngoài / ESC -> đóng menu
  useEffect(() => {
    if (!openMore) return;

    const onDown = (e) => {
      if (!moreWrapRef.current) return;
      if (!moreWrapRef.current.contains(e.target)) setOpenMore(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpenMore(false);
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMore, setOpenMore]);

  const ReplyBtn = (
    <button
      type="button"
      onClick={() => onReply?.()}
      className="grid w-8 h-8 bg-white rounded-full cursor-pointer place-items-center ring-1 ring-zinc-200 hover:bg-zinc-50"
      title="Reply"
    >
      <img className="w-[18px] h-[18px]" src="/undo_3917238.png" alt="" />
    </button>
  );

  const ReactBtn = (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpenMore(false);
          setOpenReact((v) => !v);
        }}
        className="grid w-8 h-8 bg-white rounded-full cursor-pointer place-items-center ring-1 ring-zinc-200 hover:bg-zinc-50"
        title="React"
      >
        <img className="w-[18px] h-[18px]" src="/grin-alt_6275570.png" alt="" />
      </button>

      {openReact ? (
        <div
          className={[
            "absolute bottom-full mb-2 z-40",
            "left-1/2 -translate-x-1/2",
            "flex items-center gap-1 rounded-full bg-white px-2 py-1 shadow-lg ring-1 ring-zinc-200",
          ].join(" ")}
          onMouseLeave={() => setOpenReact(false)}
        >
          {["❤️", "😆", "😮", "😭", "👍"].map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                onReact?.(e);
                setOpenReact(false);
              }}
              className="grid text-xl rounded-full cursor-pointer w-9 h-9 place-items-center hover:bg-zinc-100"
              title={e}
            >
              {e}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );

  const MoreBtn = (
    <div className="relative" ref={moreWrapRef}>
      <button
        type="button"
        onClick={() => {
          setOpenReact(false);
          setOpenMore((v) => !v);
        }}
        className="grid w-8 h-8 bg-white rounded-full cursor-pointer place-items-center ring-1 ring-zinc-200 hover:bg-zinc-50"
        title="More Options"
      >
        <img
          className="w-[16px] h-[16px]"
          src="/circle-ellipsis-vertical_10741542.png"
          alt=""
        />
      </button>

      {openMore ? (
        <div
          className={[
            "absolute bottom-full mb-2 z-50",
            mine ? "left-0" : "right-0",
            "min-w-[160px] overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-zinc-200",
          ].join(" ")}
        >
          <button
            type="button"
            className="w-full px-3 py-2 text-sm text-left cursor-pointer hover:bg-zinc-50"
            onClick={() => {
              setOpenMore(false);
              onPin?.();
            }}
          >
            {pinned ? "📌 Unpin" : "📌 Pin"}
          </button>

          {mine ? (
            <>
              <button
                type="button"
                className="w-full px-3 py-2 text-sm text-left cursor-pointer hover:bg-zinc-50"
                onClick={() => {
                  setOpenMore(false);
                  onEdit?.();
                }}
              >
                ✏️ Edit
              </button>

              <button
                type="button"
                className="w-full px-3 py-2 text-sm text-left text-red-600 cursor-pointer hover:bg-zinc-50"
                onClick={() => {
                  setOpenMore(false);
                  onRecall?.();
                }}
              >
                🗑️ Recall
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  return (
    <div className={actionBarClass}>
      {/* bên trái (not mine): Reply -> React -> More */}
      {!mine ? (
        <>
          {ReplyBtn}
          {ReactBtn}
          {MoreBtn}
        </>
      ) : (
        /* bên phải (mine): More -> React -> Reply */
        <>
          {MoreBtn}
          {ReactBtn}
          {ReplyBtn}
        </>
      )}
    </div>
  );
}
