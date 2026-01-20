import { useMemo, useState, useEffect, useRef } from "react";
import ImageLightboxModal from "./ImageLightboxModal.jsx";
import ConfirmModal from "./ConfirmModal.jsx";

const isGifUrl = (url) => /\.(gif)(\?|$)/i.test(String(url || ""));

function Section({ title, right, open, onToggle, children }) {
  return (
    <div className="relative overflow-visible bg-white border rounded-2xl border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center justify-between w-full px-4 py-3 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900"
      >
        <div className="flex items-center min-w-0 gap-2">
          <p className="font-semibold truncate text-zinc-900 dark:text-zinc-100">
            {title}
          </p>
          {right != null ? (
            <span className="text-sm text-zinc-500 dark:text-zinc-400 shrink-0">
              {right}
            </span>
          ) : null}
        </div>

        <span
          className={[
            "transition-transform text-zinc-500 dark:text-zinc-400",
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

function MediaGrid({ items, onOpenImage }) {
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
        const isGif = it.kind === "gif" || isGifUrl(it.url);
        const canLightbox = !isVideo && !isGif;
        return (
          <button
            key={it.key}
            type="button"
            className="relative overflow-hidden border cursor-pointer rounded-xl border-zinc-200 bg-zinc-50 hover:opacity-95"
            title={isVideo ? "Open video" : "Open image"}
            onClick={() => {
              if (canLightbox) onOpenImage?.(it.url);
              else window.open(it.url, "_blank", "noopener,noreferrer");
            }}
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
      <div className="px-3 py-3 text-sm border rounded-2xl border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-300">
        No files have been shared in this conversation yet.
      </div>
    );
  }

  return (
    <div className="pt-3 space-y-2">
      <div className="px-3 py-3 text-sm border rounded-2xl border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-300">
        No files have been shared in this conversation yet.
      </div>
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

export default function GroupInfo({
  chat,
  groupInfo,
  open,
  onClose,
  onOpenProfile,
  onLeaveGroup,
  onAddMember,

  // ✅ NEW props (ChatPage pass vào)
  meId,
  onKickMember,
  onMakeAdmin,
  onRemoveAdmin,
  onUpdateGroupName,
  onUpdateGroupAvatar,
}) {
  const [mediaOpen, setMediaOpen] = useState(true);
  const [fileOpen, setFileOpen] = useState(true);
  const [showAllMedia, setShowAllMedia] = useState(false);
  const [memberOpen, setMemberOpen] = useState(true);

  const name = chat?.name || "Conversation";
  const avatar = chat?.avatar;

  const counts = groupInfo?.counts || {};
  const mediaItems = groupInfo?.mediaItems || [];
  const mediaAll = groupInfo?.mediaAll || mediaItems;
  const fileItems = groupInfo?.fileItems || [];

  const members = groupInfo?.members || [];

  // ✅ admins + ownerId (để hiển thị đúng quyền)
  // ✅ admins + ownerId (đọc từ chat._raw vì mapConversationsToChats gói data ở đó)
  const adminIds =
    groupInfo?.adminIds || chat?._raw?.adminIds || chat?._raw?.admins || [];

  const ownerId =
    groupInfo?.createdBy ||
    chat?._raw?.createdBy ||
    groupInfo?.ownerId ||
    chat?._raw?.ownerId ||
    null;

  const isGroup = String(chat?.type || "") === "group";

  const isOwner = ownerId && meId && String(ownerId) === String(meId);

  const adminSet = useMemo(
    () => new Set((adminIds || []).map(String)),
    [adminIds],
  );

  const isMeAdmin = !!meId && adminSet.has(String(meId));

  // ✅ Owner + Admin kick được
  const canKick = isOwner || isMeAdmin;

  // ✅ Chỉ Owner mới make/remove admin
  const canSetAdmin = isOwner;

  // ✅ Owner/Admin mới edit name + avatar
  const canEditGroup = isGroup && (isOwner || isMeAdmin);

  // ===== Edit group name =====
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(name);
  const [busyName, setBusyName] = useState(false);

  // ===== Edit group avatar =====
  const fileRef = useRef(null);
  const [busyAvatar, setBusyAvatar] = useState(false);

  // ✅ sync draft khi đổi conversation
  useEffect(() => {
    setEditingName(false);
    setNameDraft(name);
  }, [chat?.id, name]);

  const [lightboxSrc, setLightboxSrc] = useState(null);

  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);

  // ✅ Kick confirm modal
  const [kickOpen, setKickOpen] = useState(false);
  const [kickLoading, setKickLoading] = useState(false);
  const [kickTarget, setKickTarget] = useState(null);

  const startEditName = () => {
    if (!canEditGroup) return;
    setNameDraft(name);
    setEditingName(true);
  };

  const cancelEditName = () => {
    setEditingName(false);
    setNameDraft(name);
  };

  const submitEditName = async () => {
    if (!canEditGroup || busyName) return;
    const next = String(nameDraft || "").trim();
    if (!next || next === name) {
      cancelEditName();
      return;
    }

    try {
      setBusyName(true);
      await onUpdateGroupName?.(next);
      setEditingName(false);
    } finally {
      setBusyName(false);
    }
  };

  const triggerPickAvatar = (e) => {
    e?.stopPropagation?.();
    if (!canEditGroup || busyAvatar) return;
    fileRef.current?.click();
  };

  const onPickAvatarFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !canEditGroup) return;

    try {
      setBusyAvatar(true);
      await onUpdateGroupAvatar?.(file);
    } finally {
      setBusyAvatar(false);
      // reset để chọn lại cùng 1 file vẫn trigger change
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const mediaRight = useMemo(() => {
    const total = Number(counts.mediaTotal ?? mediaItems.length) || 0;
    return total ? `(${total})` : "(0)";
  }, [counts.mediaTotal, mediaItems.length]);

  const fileRight = useMemo(() => {
    const total = Number(counts.docs ?? fileItems.length) || 0;
    return total ? `(${total})` : "(0)";
  }, [counts.docs, fileItems.length]);

  const memberRight = useMemo(() => {
    const total = Number(members.length) || 0;
    return total ? `(${total})` : "(0)";
  }, [members.length]);

  // log ra xem có phải là admin hay không

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPickAvatarFile}
      />

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
            "absolute right-0 top-0 h-full w-[92vw] max-w-[330px] bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 flex flex-col",
            "transition-transform duration-200 ease-out",
            open ? "translate-x-0" : "translate-x-full",
          ].join(" ")}
        >
          <div className="flex items-center justify-between h-16 px-5 border-b border-zinc-200 dark:border-zinc-800">
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">
              Conversation Info
            </p>
            <button
              onClick={onClose}
              className="cursor-pointer h-9 w-9 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-100"
              title="Close"
              type="button"
            >
              ✕
            </button>
          </div>

          <div className="p-5 space-y-5 overflow-y-auto">
            <div className="flex flex-col items-center gap-3">
              {/* Avatar + camera overlay */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => onOpenProfile?.()}
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
                    <div className="grid w-full h-full place-items-center bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-200">
                      🙂
                    </div>
                  )}
                </button>

                {/* ✅ camera icon inside avatar */}
                {isGroup && canEditGroup ? (
                  <button
                    type="button"
                    onClick={triggerPickAvatar}
                    disabled={busyAvatar}
                    className="absolute grid bg-white border rounded-full cursor-pointer dark:bg-zinc-900 bottom-1 right-1 w-7 h-7 place-items-center border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-60"
                    title="Change group avatar"
                  >
                    📷
                  </button>
                ) : null}
              </div>

              {/* Name + pencil edit */}
              {isGroup ? (
                editingName ? (
                  <div className="flex items-center justify-center w-full gap-2">
                    <input
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitEditName();
                        if (e.key === "Escape") cancelEditName();
                      }}
                      className="h-9 w-[220px] px-3 text-sm border rounded-xl border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-violet-200"
                      placeholder="Group name..."
                      autoFocus
                      disabled={busyName}
                    />

                    <button
                      type="button"
                      onClick={submitEditName}
                      disabled={busyName}
                      className="grid border cursor-pointer w-9 h-9 rounded-xl place-items-center border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-100 disabled:opacity-60"
                      title="Save"
                    >
                      ✓
                    </button>

                    <button
                      type="button"
                      onClick={cancelEditName}
                      disabled={busyName}
                      className="grid border cursor-pointer w-9 h-9 rounded-xl place-items-center border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-100 disabled:opacity-60"
                      title="Cancel"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <p className="text-lg font-bold text-center text-zinc-900 dark:text-zinc-100">
                      {name}
                    </p>

                    {canEditGroup ? (
                      <button
                        type="button"
                        onClick={startEditName}
                        className="grid border cursor-pointer w-9 h-9 rounded-xl place-items-center border-zinc-200 hover:bg-zinc-50 text-zinc-700"
                        title="Edit name"
                      >
                        ✎
                      </button>
                    ) : null}
                  </div>
                )
              ) : (
                <p className="text-lg font-bold text-center text-zinc-900 dark:text-zinc-100">
                  {name}
                </p>
              )}
            </div>

            <Section
              title="Members"
              right={memberRight}
              open={memberOpen}
              onToggle={() => setMemberOpen((v) => !v)}
            >
              <MemberList
                items={members}
                adminIds={adminIds}
                meId={meId}
                ownerId={ownerId}
                onOpenProfile={onOpenProfile}
                onRequestKick={(m) => {
                  setKickTarget(m);
                  setKickOpen(true);
                }}
                onMakeAdmin={onMakeAdmin}
                onRemoveAdmin={onRemoveAdmin}
                // ✅ owner-only actions (như rule mày muốn)
                canKick={canKick}
                canSetAdmin={canSetAdmin}
              />

              {String(chat?.type) === "group" &&
              typeof onAddMember === "function" ? (
                <button
                  type="button"
                  onClick={onAddMember}
                  className="w-full h-10 mt-3 text-sm font-semibold border cursor-pointer rounded-xl border-violet-200 dark:border-violet-500/30 hover:bg-violet-50 dark:hover:bg-violet-500/10 text-violet-700 dark:text-violet-200"
                >
                  + Add member
                </button>
              ) : null}
            </Section>

            <Section
              title="Pictures / Video"
              right={mediaRight}
              open={mediaOpen}
              onToggle={() => setMediaOpen((v) => !v)}
            >
              <div
                className={
                  showAllMedia ? "max-h-[320px] overflow-y-auto pr-1" : ""
                }
              >
                <MediaGrid
                  items={showAllMedia ? mediaAll : mediaItems}
                  onOpenImage={(url) => setLightboxSrc(url)}
                />
              </div>

              <button
                type="button"
                className="w-full h-10 mt-3 text-sm font-semibold border cursor-pointer rounded-xl border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-100 disabled:opacity-50 disabled:hover:bg-white disabled:dark:hover:bg-zinc-900"
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

            {isGroup ? (
              <button
                type="button"
                onClick={() => setLeaveOpen(true)}
                className="w-full h-10 text-sm font-semibold text-red-600 border border-red-200 cursor-pointer rounded-xl hover:bg-red-50"
              >
                Leave group
              </button>
            ) : null}
          </div>
        </aside>
      </div>

      {/* DESKTOP (lg) */}
      <aside
        className={[
          "hidden lg:flex shrink-0 bg-white dark:bg-zinc-950 overflow-hidden",
          "transition-[width] duration-300 ease-in-out",
          open
            ? "w-[330px] border-l border-zinc-200 dark:border-zinc-800"
            : "w-0 border-l-0",
        ].join(" ")}
      >
        <div
          className={[
            "w-[330px] h-full flex flex-col",
            "transition-all duration-200 ease-out",
            open
              ? "opacity-100 translate-x-0"
              : "opacity-0 translate-x-2 pointer-events-none",
          ].join(" ")}
        >
          <div className="flex items-center justify-between h-16 px-5 border-b border-zinc-200 dark:border-zinc-800">
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">
              Conversation Info
            </p>
            <button
              onClick={onClose}
              className="cursor-pointer h-9 w-9 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-100"
              title="Close"
              type="button"
            >
              ✕
            </button>
          </div>

          <div className="p-5 space-y-5 overflow-y-auto">
            <div className="flex flex-col items-center gap-3">
              {/* Avatar + camera overlay */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => onOpenProfile?.()}
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
                    <div className="grid w-full h-full place-items-center bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-200">
                      🙂
                    </div>
                  )}
                </button>

                {/* ✅ camera icon inside avatar */}
                {isGroup && canEditGroup ? (
                  <button
                    type="button"
                    onClick={triggerPickAvatar}
                    disabled={busyAvatar}
                    className="absolute grid bg-white border rounded-full cursor-pointer dark:bg-zinc-900 bottom-1 right-1 w-7 h-7 place-items-center border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-60"
                    title="Change group avatar"
                  >
                    📷
                  </button>
                ) : null}
              </div>

              {/* Name + pencil edit */}
              {isGroup ? (
                editingName ? (
                  <div className="flex items-center justify-center w-full gap-2">
                    <input
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitEditName();
                        if (e.key === "Escape") cancelEditName();
                      }}
                      className="h-9 w-[220px] px-3 text-sm border rounded-xl border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-violet-200"
                      placeholder="Group name..."
                      autoFocus
                      disabled={busyName}
                    />

                    <button
                      type="button"
                      onClick={submitEditName}
                      disabled={busyName}
                      className="grid border cursor-pointer w-9 h-9 rounded-xl place-items-center border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-100 disabled:opacity-60"
                      title="Save"
                    >
                      ✓
                    </button>

                    <button
                      type="button"
                      onClick={cancelEditName}
                      disabled={busyName}
                      className="grid border cursor-pointer w-9 h-9 rounded-xl place-items-center border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-100 disabled:opacity-60"
                      title="Cancel"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <p className="text-lg font-bold text-center text-zinc-900 dark:text-zinc-100">
                      {name}
                    </p>

                    {canEditGroup ? (
                      <button
                        type="button"
                        onClick={startEditName}
                        className="grid border cursor-pointer w-9 h-9 rounded-xl place-items-center border-zinc-200 hover:bg-zinc-50 text-zinc-700"
                        title="Edit name"
                      >
                        ✎
                      </button>
                    ) : null}
                  </div>
                )
              ) : (
                <p className="text-lg font-bold text-center text-zinc-900 dark:text-zinc-100">
                  {name}
                </p>
              )}
            </div>

            <Section
              title="Members"
              right={memberRight}
              open={memberOpen}
              onToggle={() => setMemberOpen((v) => !v)}
            >
              <MemberList
                items={members}
                adminIds={adminIds}
                meId={meId}
                ownerId={ownerId}
                onOpenProfile={onOpenProfile}
                onRequestKick={(m) => {
                  setKickTarget(m);
                  setKickOpen(true);
                }}
                onMakeAdmin={onMakeAdmin}
                onRemoveAdmin={onRemoveAdmin}
                canKick={canKick}
                canSetAdmin={canSetAdmin}
              />

              {String(chat?.type) === "group" &&
              typeof onAddMember === "function" ? (
                <button
                  type="button"
                  onClick={onAddMember}
                  className="w-full h-10 mt-3 text-sm font-semibold border cursor-pointer rounded-xl border-violet-200 dark:border-violet-500/30 hover:bg-violet-50 dark:hover:bg-violet-500/10 text-violet-700 dark:text-violet-200"
                >
                  + Add member
                </button>
              ) : null}
            </Section>

            <Section
              title="Pictures / Video"
              right={mediaRight}
              open={mediaOpen}
              onToggle={() => setMediaOpen((v) => !v)}
            >
              <div
                className={
                  showAllMedia ? "max-h-[320px] overflow-y-auto pr-1" : ""
                }
              >
                <MediaGrid
                  items={showAllMedia ? mediaAll : mediaItems}
                  onOpenImage={(url) => setLightboxSrc(url)}
                />
              </div>

              <button
                type="button"
                className="w-full h-10 mt-3 text-sm font-semibold border cursor-pointer rounded-xl border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-100 disabled:opacity-50 disabled:hover:bg-white disabled:dark:hover:bg-zinc-900"
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

            {isGroup ? (
              <button
                type="button"
                onClick={() => setLeaveOpen(true)}
                className="w-full h-10 text-sm font-semibold text-red-600 border border-red-200 cursor-pointer rounded-xl hover:bg-red-50"
              >
                Leave group
              </button>
            ) : null}
          </div>
        </div>
      </aside>

      <ImageLightboxModal
        open={!!lightboxSrc}
        src={lightboxSrc}
        onClose={() => setLightboxSrc(null)}
      />

      {/* ✅ Leave confirm */}
      <ConfirmModal
        open={leaveOpen}
        title="Leave group?"
        description="Are you sure you want to leave this group?"
        cancelText="Cancel"
        confirmText="Confirm"
        loading={leaveLoading}
        onCancel={() => {
          if (!leaveLoading) setLeaveOpen(false);
        }}
        onConfirm={async () => {
          try {
            setLeaveLoading(true);
            await onLeaveGroup?.();
            setLeaveOpen(false);
          } finally {
            setLeaveLoading(false);
          }
        }}
      />

      {/* ✅ Kick confirm */}
      <ConfirmModal
        open={kickOpen}
        title={`Kick ${kickTarget?.name || "member"}?`}
        description="They will be removed from this group."
        cancelText="Cancel"
        confirmText="Kick"
        loading={kickLoading}
        onCancel={() => {
          if (!kickLoading) setKickOpen(false);
        }}
        onConfirm={async () => {
          try {
            setKickLoading(true);
            // onKickMember(userId, memberObj)
            await onKickMember?.(
              String(kickTarget?.id || kickTarget?._id || ""),
              kickTarget,
            );
            setKickOpen(false);
          } finally {
            setKickLoading(false);
          }
        }}
      />
    </>
  );
}

function MemberList({
  items,
  adminIds = [],
  onOpenProfile,
  meId,
  ownerId,
  onRequestKick,
  onMakeAdmin,
  onRemoveAdmin,
  canKick = false,
  canSetAdmin = false,
}) {
  const [openMenuId, setOpenMenuId] = useState(null);

  if (!items?.length) {
    return (
      <div className="px-3 py-3 text-sm border rounded-2xl border-zinc-200 bg-zinc-50 text-zinc-500">
        No members.
      </div>
    );
  }

  const adminSet = new Set((adminIds || []).map(String));
  const my = String(meId || "");
  const owner = String(ownerId || "");

  const pickId = (m) => String(m?.id || m?._id || "");

  return (
    <div className="pt-3 space-y-2">
      {/* click outside to close menu */}
      {openMenuId ? (
        <button
          type="button"
          className="fixed inset-0 z-[155] cursor-default"
          onClick={() => setOpenMenuId(null)}
        />
      ) : null}

      {items.map((m) => {
        const mid = pickId(m);
        const isAdmin = adminSet.has(mid);
        const isMe = mid && my && mid === my;
        const isOwnerMember = mid && owner && mid === owner;

        const isOwnerMe = my && owner && my === owner;

        // ✅ Admin kick được member thường, nhưng:
        // - không kick chính mình
        // - không kick owner
        // - admin không kick admin khác (chỉ owner kick admin)
        const showKick =
          canKick && !isMe && !isOwnerMember && (isOwnerMe || !isAdmin);

        const showAdminActions = canSetAdmin && !isOwnerMember;

        return (
          <div
            key={mid || m.email || m.name}
            className={[
              "relative flex items-center w-full gap-3 p-3 border rounded-2xl border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900",
              openMenuId === mid ? "z-[200]" : "z-0",
            ].join(" ")}
          >
            {/* left area: open profile */}
            <button
              type="button"
              className="flex items-center flex-1 min-w-0 gap-3 text-left cursor-pointer"
              onClick={() => onOpenProfile?.(mid, m)}
              title="Open profile"
            >
              {m?.avatarUrl || m?.avatar ? (
                <img
                  src={m.avatarUrl || m.avatar}
                  alt={m.name}
                  className="object-cover w-10 h-10 rounded-full shrink-0"
                />
              ) : (
                <div className="grid w-10 h-10 rounded-full shrink-0 place-items-center bg-zinc-100 text-zinc-600">
                  🙂
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="grid items-center gap-2 min-w-0 w-full grid-cols-[minmax(0,1fr)_auto]">
                  {/* Name */}
                  <p className="min-w-0 font-semibold truncate text-zinc-900 dark:text-zinc-100">
                    {m?.name || "Member"}
                  </p>

                  {/* Badges */}
                  <div className="flex items-center gap-1 shrink-0 ">
                    {isOwnerMember ? (
                      <span className="px-2 py-0.5 text-[11px] rounded-full bg-amber-100 text-amber-700 whitespace-nowrap">
                        Owner
                      </span>
                    ) : null}

                    {isAdmin ? (
                      <span className="px-2 py-0.5 text-[11px] rounded-full bg-violet-100 text-violet-700 whitespace-nowrap">
                        Admin
                      </span>
                    ) : null}

                    {isMe ? (
                      <span className="px-2 py-0.5 text-[11px] rounded-full bg-zinc-100 text-zinc-700 whitespace-nowrap">
                        You
                      </span>
                    ) : null}
                  </div>
                </div>

                <p className="text-xs truncate text-zinc-500 dark:text-zinc-400">
                  {m.email || m.role || "Member"}
                </p>
              </div>
            </button>

            {/* ⋯ actions */}
            <button
              type="button"
              className="grid cursor-pointer w-9 h-9 rounded-xl place-items-center hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-100"
              title="More"
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenuId((prev) => (prev === mid ? null : mid));
              }}
            >
              ⋯
            </button>

            {/* Dropdown menu */}
            {openMenuId === mid ? (
              <div className="absolute right-3 top-[56px] z-[170] w-48 p-1 bg-white dark:bg-zinc-900 border shadow-lg rounded-xl border-zinc-200 dark:border-zinc-700">
                <button
                  type="button"
                  className="w-full px-3 py-2 text-sm text-left rounded-lg cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  onClick={() => {
                    setOpenMenuId(null);
                    onOpenProfile?.(mid, m);
                  }}
                >
                  View profile
                </button>

                {/* Admin actions (chuẩn bị sẵn) */}
                {showAdminActions &&
                typeof onMakeAdmin === "function" &&
                typeof onRemoveAdmin === "function" ? (
                  isAdmin ? (
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-sm text-left rounded-lg cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                      onClick={async () => {
                        setOpenMenuId(null);
                        await onRemoveAdmin?.(mid, m);
                      }}
                    >
                      Remove admin
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-sm text-left rounded-lg cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                      onClick={async () => {
                        setOpenMenuId(null);
                        await onMakeAdmin?.(mid, m);
                      }}
                    >
                      Make admin
                    </button>
                  )
                ) : null}

                {/* Kick */}
                {showKick ? (
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-sm text-left text-red-600 rounded-lg cursor-pointer hover:bg-red-50 dark:hover:bg-red-500/10"
                    onClick={() => {
                      setOpenMenuId(null);
                      onRequestKick?.(m);
                    }}
                  >
                    Kick member
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
