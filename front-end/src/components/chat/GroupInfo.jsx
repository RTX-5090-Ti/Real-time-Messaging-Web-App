import React, { useMemo, useState } from "react";

function Section({ title, right, open, onToggle, children }) {
  return (
    <div className="overflow-hidden border rounded-2xl border-zinc-200">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center justify-between w-full px-4 py-3 cursor-pointer hover:bg-zinc-50"
      >
        <div className="flex items-center min-w-0 gap-2">
          <p className="font-semibold truncate text-zinc-900">{title}</p>
          {right != null ? (
            <span className="text-sm text-zinc-500 shrink-0">{right}</span>
          ) : null}
        </div>

        <span
          className={[
            "transition-transform text-zinc-500",
            open ? "rotate-180" : "rotate-0",
          ].join(" ")}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {open ? <div className="p-4 pt-0">{children}</div> : null}
    </div>
  );
}

function MediaGrid({ items }) {
  if (!items?.length) {
    return (
      <div className="px-3 py-3 text-sm border rounded-2xl border-zinc-200 bg-zinc-50 text-zinc-500">
        There are no photos/videos in this conversation.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2 pt-3">
      {items.map((it) => {
        const isVideo = it.kind === "video";
        return (
          <button
            key={it.key}
            type="button"
            className="relative overflow-hidden border cursor-pointer rounded-xl border-zinc-200 bg-zinc-50 hover:opacity-95"
            title={isVideo ? "Open video" : "Open image"}
            onClick={() => window.open(it.url, "_blank", "noopener,noreferrer")}
          >
            <div className="aspect-square">
              {isVideo ? (
                <video
                  src={it.url}
                  className="object-cover w-full h-full"
                  muted
                  playsInline
                  preload="metadata"
                />
              ) : (
                <img
                  src={it.url}
                  alt=""
                  className="object-cover w-full h-full"
                  loading="lazy"
                />
              )}
            </div>

            {isVideo ? (
              <span className="absolute bottom-1 right-1 text-[11px] px-1.5 py-0.5 rounded-lg bg-black/60 text-white">
                ▶
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function FileList({ items }) {
  if (!items?.length) {
    return (
      <div className="px-3 py-3 text-sm border rounded-2xl border-zinc-200 bg-zinc-50 text-zinc-500">
        No files have been shared in this conversation yet.
      </div>
    );
  }

  return (
    <div className="pt-3 space-y-2">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          className="flex items-center w-full gap-3 p-3 text-left border cursor-pointer rounded-2xl border-zinc-200 hover:bg-zinc-50"
          title="Open file"
          onClick={() => window.open(it.url, "_blank", "noopener,noreferrer")}
        >
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-zinc-100">
            📎
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate text-zinc-900">
              {it.name || "File"}
            </p>
            <p className="text-xs truncate text-zinc-500">
              {it.mime || it.url}
            </p>
          </div>
          <span className="text-xs text-zinc-500">↗</span>
        </button>
      ))}
    </div>
  );
}

export default function GroupInfo({ chat, groupInfo, open, onClose }) {
  const [mediaOpen, setMediaOpen] = useState(true);
  const [fileOpen, setFileOpen] = useState(true);
  const [showAllMedia, setShowAllMedia] = useState(false);

  const name = chat?.name || "Conversation";
  const avatar = chat?.avatar;

  const counts = groupInfo?.counts || {};
  const mediaItems = groupInfo?.mediaItems || [];
  const mediaAll = groupInfo?.mediaAll || mediaItems;
  const fileItems = groupInfo?.fileItems || [];

  const mediaRight = useMemo(() => {
    const total = Number(counts.mediaTotal ?? mediaItems.length) || 0;
    return total ? `(${total})` : "(0)";
  }, [counts.mediaTotal, mediaItems.length]);

  const fileRight = useMemo(() => {
    const total = Number(counts.docs ?? fileItems.length) || 0;
    return total ? `(${total})` : "(0)";
  }, [counts.docs, fileItems.length]);

  return (
    <>
      {/* MOBILE overlay */}
      <div
        className={[
          "fixed inset-0 z-[150] lg:hidden transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0 pointer-events-none",
        ].join(" ")}
      >
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />

        <aside
          className={[
            "absolute right-0 top-0 h-full w-[330px] bg-white border-l border-zinc-200 flex flex-col",
            "transition-transform duration-200 ease-out",
            open ? "translate-x-0" : "translate-x-full",
          ].join(" ")}
        >
          <div className="flex items-center justify-between h-16 px-5 border-b border-zinc-200">
            <p className="font-semibold text-zinc-900">Conversation Info</p>
            <button
              onClick={onClose}
              className="cursor-pointer h-9 w-9 rounded-xl hover:bg-zinc-100 text-zinc-700"
              title="Close"
              type="button"
            >
              ✕
            </button>
          </div>

          <div className="p-5 space-y-5 overflow-y-auto">
            {/* TOP: avatar + name (style giống Sidebar, nhưng tone theo nền trắng) */}
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => {}}
                className="w-20 h-20 rounded-full overflow-hidden cursor-pointer transition outline-none focus:outline-none focus:ring-0 hover:bg-zinc-50 hover:shadow-[0_0_0_3px_rgba(0,0,0,0.08)]"
                title="Open profile"
              >
                {avatar ? (
                  <img
                    src={avatar}
                    alt={name}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <div className="grid w-full h-full place-items-center bg-zinc-100 text-zinc-600">
                    🙂
                  </div>
                )}
              </button>

              <p className="text-lg font-bold text-center text-zinc-900">
                {name}
              </p>
            </div>

            {/* Sections */}
            <Section
              title="Ảnh / Video"
              right={mediaRight}
              open={mediaOpen}
              onToggle={() => setMediaOpen((v) => !v)}
            >
              <div
                className={
                  showAllMedia ? "max-h-[320px] overflow-y-auto pr-1" : ""
                }
              >
                <MediaGrid items={showAllMedia ? mediaAll : mediaItems} />
              </div>

              <button
                type="button"
                className="w-full h-10 mt-3 text-sm font-semibold border cursor-pointer rounded-xl border-zinc-200 hover:bg-zinc-50 text-zinc-700 disabled:opacity-50 disabled:hover:bg-white"
                onClick={() => setShowAllMedia((v) => !v)}
                disabled={!showAllMedia && mediaAll.length <= mediaItems.length}
              >
                {showAllMedia ? "Collapse" : "View all"}
              </button>
            </Section>

            <Section
              title="File"
              right={fileRight}
              open={fileOpen}
              onToggle={() => setFileOpen((v) => !v)}
            >
              <FileList items={fileItems} />
            </Section>
          </div>
        </aside>
      </div>

      {/* DESKTOP (lg) */}
      <aside
        className={[
          "hidden lg:flex shrink-0 bg-white overflow-hidden",
          "transition-[width] duration-300 ease-in-out",
          open ? "w-[330px] border-l border-zinc-200" : "w-0 border-l-0",
        ].join(" ")}
      >
        {/* container cố định 330 để content không bị co méo */}
        <div
          className={[
            "w-[330px] h-full flex flex-col",
            "transition-all duration-200 ease-out",
            open
              ? "opacity-100 translate-x-0"
              : "opacity-0 translate-x-2 pointer-events-none",
          ].join(" ")}
        >
          <div className="flex items-center justify-between h-16 px-5 border-b border-zinc-200">
            <p className="font-semibold text-zinc-900">Conversation Info</p>
            <button
              onClick={onClose}
              className="cursor-pointer h-9 w-9 rounded-xl hover:bg-zinc-100 text-zinc-700"
              title="Close"
              type="button"
            >
              ✕
            </button>
          </div>

          <div className="p-5 space-y-5 overflow-y-auto">
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => {}}
                className="w-20 h-20 rounded-full overflow-hidden cursor-pointer transition outline-none focus:outline-none focus:ring-0 hover:bg-zinc-50 hover:shadow-[0_0_0_3px_rgba(0,0,0,0.08)]"
                title="Open profile"
              >
                {avatar ? (
                  <img
                    src={avatar}
                    alt={name}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <div className="grid w-full h-full place-items-center bg-zinc-100 text-zinc-600">
                    🙂
                  </div>
                )}
              </button>

              <p className="text-lg font-bold text-center text-zinc-900">
                {name}
              </p>
            </div>

            <Section
              title="Ảnh / Video"
              right={mediaRight}
              open={mediaOpen}
              onToggle={() => setMediaOpen((v) => !v)}
            >
              <div
                className={
                  showAllMedia ? "max-h-[320px] overflow-y-auto pr-1" : ""
                }
              >
                <MediaGrid items={showAllMedia ? mediaAll : mediaItems} />
              </div>

              <button
                type="button"
                className="w-full h-10 mt-3 text-sm font-semibold border cursor-pointer rounded-xl border-zinc-200 hover:bg-zinc-50 text-zinc-700 disabled:opacity-50 disabled:hover:bg-white"
                onClick={() => setShowAllMedia((v) => !v)}
                disabled={!showAllMedia && mediaAll.length <= mediaItems.length}
              >
                {showAllMedia ? "Collapse" : "View all"}
              </button>
            </Section>

            <Section
              title="File"
              right={fileRight}
              open={fileOpen}
              onToggle={() => setFileOpen((v) => !v)}
            >
              <FileList items={fileItems} />
            </Section>
          </div>
        </div>
      </aside>
    </>
  );
}
