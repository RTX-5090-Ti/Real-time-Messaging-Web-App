import React from "react";

function Row({ left, right }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 transition rounded-xl hover:bg-zinc-50">
      <div className="flex items-center gap-2 text-sm text-zinc-700">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-zinc-100">
          ▦
        </span>
        <span className="capitalize">{left}</span>
      </div>
      <span className="text-sm text-zinc-500">{right}</span>
    </div>
  );
}

function FilesSection({ files }) {
  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-zinc-900">Files</p>

      {files?.length ? (
        <div className="space-y-1">
          {files.map((f) => (
            <Row key={f.label} left={f.label} right={f.count} />
          ))}
        </div>
      ) : (
        <div className="px-3 py-3 text-sm border rounded-2xl border-zinc-200 bg-zinc-50 text-zinc-500">
          No files yet.
        </div>
      )}
    </div>
  );
}

function MembersSection({ members, membersTitle }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-zinc-900">{membersTitle}</p>
        <button
          className="text-sm font-semibold text-violet-700 hover:text-violet-800"
          type="button"
          onClick={() => {}}
        >
          View all
        </button>
      </div>

      {members?.length ? (
        <div className="space-y-2">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 p-3 transition rounded-2xl hover:bg-zinc-50"
            >
              <img
                src={m.avatar}
                alt={m.name}
                className="object-cover w-10 h-10 rounded-full"
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate text-zinc-900">{m.name}</p>
                <p className="text-xs text-zinc-500">{m.role ?? "member"}</p>
              </div>

              <button
                className="text-xs font-semibold text-zinc-600 hover:text-zinc-800"
                type="button"
                title="More"
              >
                …
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-3 py-3 text-sm border rounded-2xl border-zinc-200 bg-zinc-50 text-zinc-500">
          No members to show.
        </div>
      )}
    </div>
  );
}

export default function GroupInfo({ chat, groupInfo, open, onClose }) {
  const files = groupInfo?.files || [];
  const members = groupInfo?.members || [];

  const membersTitle = chat
    ? `${chat.members ?? members.length} members`
    : "Members";

  return (
    <>
      {/* MOBILE: drawer overlay */}
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
              className="h-9 w-9 rounded-xl hover:bg-zinc-100 text-zinc-700"
              title="Close"
              type="button"
            >
              ✕
            </button>
          </div>

          <div className="p-5 space-y-6 overflow-y-auto">
            <FilesSection files={files} />
            <MembersSection members={members} membersTitle={membersTitle} />
          </div>
        </aside>
      </div>

      {/* DESKTOP: inline panel có width=0 khi đóng để ChatWindow chiếm full */}
      <aside
        className={[
          "hidden lg:flex shrink-0 bg-white overflow-hidden",
          "transition-[width] duration-300 ease-in-out",
          open ? "w-[330px] border-l border-zinc-200" : "w-0 border-l-0",
        ].join(" ")}
      >
        <div className="w-[330px] h-full flex flex-col">
          <div className="flex items-center justify-between h-16 px-5 border-b border-zinc-200">
            <p className="font-semibold text-zinc-900">Conversation Info</p>
            <button
              onClick={onClose}
              className="h-9 w-9 rounded-xl hover:bg-zinc-100 text-zinc-700"
              title="Close"
              type="button"
            >
              ✕
            </button>
          </div>

          <div className="p-5 space-y-6 overflow-y-auto">
            <FilesSection files={files} />
            <MembersSection members={members} membersTitle={membersTitle} />
          </div>
        </div>
      </aside>
    </>
  );
}
