import { useMemo, useRef, useEffect, useState } from "react";
import NotificationsDropdown from "./NotificationsDropdown.jsx";

function ChatItem({
  c,
  active,
  onSelectChat,
  onViewProfile,
  onDeleteChat,
  onReport,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const btnRef = useRef(null);

  const toggleMenu = (e) => {
    e.stopPropagation();
    setMenuOpen((v) => !v);
  };

  const handleAction = (fn) => (e) => {
    e.stopPropagation();
    fn && fn(c);
    setMenuOpen(false);
  };

  useEffect(() => {
    if (!menuOpen) return;

    const onDown = (e) => {
      // click ngoài menu và ngoài nút 3 chấm => đóng
      if (menuRef.current?.contains(e.target)) return;
      if (btnRef.current?.contains(e.target)) return;
      setMenuOpen(false);
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [menuOpen]);

  return (
    <button
      onClick={() => onSelectChat(c.id)}
      className={[
        "group relative w-full text-left rounded-2xl p-3 flex gap-3 items-center transition cursor-pointer",
        active ? "bg-violet-50 ring-1 ring-violet-200" : "hover:bg-zinc-50",
      ].join(" ")}
      type="button"
    >
      <img
        src={c.avatar}
        alt={c.name}
        className="object-cover w-11 h-11 rounded-2xl"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold truncate text-zinc-900">{c.name}</p>
          <p className="text-xs text-zinc-400 shrink-0">{c.time}</p>
        </div>
        <p className="text-sm truncate text-zinc-500">{c.lastMessage}</p>
      </div>

      {c.unread > 0 ? (
        <span className="inline-flex items-center justify-center h-6 px-2 text-xs font-bold text-white bg-orange-500 rounded-full min-w-6">
          {c.unread}
        </span>
      ) : (
        <span className="w-6 h-6" />
      )}

      {/* Nút 3 chấm */}
      <div
        ref={btnRef}
        className="absolute items-center justify-center hidden w-8 h-8 transition scale-90 -translate-y-1/2 rounded-full opacity-0 right-3 top-1/2 group-hover:flex group-hover:opacity-100 group-hover:scale-100 group-hover:bg-violet-100/60 hover:bg-violet-200 active:bg-violet-300"
        onClick={toggleMenu}
      >
        <svg
          viewBox="0 0 24 24"
          className="w-5 h-5 text-violet-700"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="19" cy="12" r="1.6" />
        </svg>
      </div>

      {/* Menu box */}
      <div
        ref={menuRef}
        onClick={(e) => e.stopPropagation()}
        className={[
          "absolute right-3 top-1/2 translate-y-3 z-30",
          "w-52 rounded-xl bg-white shadow-lg ring-1 ring-black/5 overflow-hidden",
          "origin-top-right transition-all duration-150",
          menuOpen
            ? "pointer-events-auto opacity-100 scale-100 translate-y-4"
            : "pointer-events-none opacity-0 scale-95 translate-y-3",
        ].join(" ")}
      >
        {/* item class chung */}
        {[
          {
            label: "View profile",
            onClick: handleAction(onViewProfile),
            icon: (
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M20 21a8 8 0 0 0-16 0" />
                <circle cx="12" cy="8" r="4" />
              </svg>
            ),
          },
          {
            label: "Delete chat",
            onClick: handleAction(onDeleteChat),
            icon: (
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 6h18" />
                <path d="M8 6V4h8v2" />
                <path d="M6 6l1 16h10l1-16" />
              </svg>
            ),
          },
          {
            label: "Report",
            onClick: handleAction(onReport),
            icon: (
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M5 3v18" />
                <path d="M5 4h11l-1 4 1 4H5" />
              </svg>
            ),
          },
        ].map((item) => (
          <div
            key={item.label}
            role="menuitem"
            tabIndex={0}
            className="cursor-pointer w-full flex items-center gap-3 px-3 py-2.5 text-sm text-zinc-700 transition-colors hover:bg-violet-50 hover:text-violet-700"
            onClick={item.onClick}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") item.onClick?.(e);
            }}
          >
            <span className="transition-colors text-zinc-500">{item.icon}</span>
            <span className="text-left">{item.label}</span>
          </div>
        ))}
      </div>
    </button>
  );
}

function Dot({ online }) {
  return (
    <span
      className={[
        "inline-block h-2.5 w-2.5 rounded-full",
        online ? "bg-emerald-500" : "bg-zinc-300",
      ].join(" ")}
    />
  );
}

function NavButton({ active, label, badge, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={[
        "relative w-full py-3 grid place-items-center rounded-2xl transition cursor-pointer",
        active
          ? "bg-white/10 text-white"
          : "text-white/70 hover:bg-white/10 hover:text-white",
      ].join(" ")}
      title={label}
      type="button"
    >
      <div className="relative grid place-items-center">
        {children}
        {badge > 0 ? (
          <span className="absolute -right-3 -top-2 min-w-[20px] h-5 px-1 text-[11px] font-bold rounded-full bg-orange-500 text-white grid place-items-center">
            {badge > 99 ? "99+" : badge}
          </span>
        ) : null}
      </div>
      <div className="mt-1 text-[11px] font-medium">{label}</div>
    </button>
  );
}

function IconBtn({ onClick, title, children, badge = 0 }) {
  return (
    <button
      onClick={onClick}
      className="relative grid transition bg-white border cursor-pointer w-9 h-9 rounded-xl border-zinc-200 hover:bg-zinc-50 place-items-center"
      title={title}
      type="button"
    >
      {children}
      {badge > 0 ? (
        <span className="absolute -right-2 -top-2 min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-orange-500 text-white grid place-items-center">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </button>
  );
}

export default function Sidebar({
  me,
  chats,
  friends,
  activeChatId,
  onSelectChat,
  tab,
  setTab,
  onLogout,
  onProfile,
  onFindFriend,
  onCreateGroup,

  // ✅ NEW: click friend -> open chat
  onMessageFriend,

  // ✅ notifications
  notificationsOpen = false,
  notificationsCount = 0,
  notifications = [],
  onToggleNotifications,
  onCloseNotifications,
  onAcceptRequest,
  onRejectRequest,
  onClearAllNotifications,
  onViewProfile,
  onDeleteChat,
  onReport,
}) {
  const totalUnread = useMemo(
    () => (chats || []).reduce((sum, c) => sum + (Number(c.unread) || 0), 0),
    [chats]
  );

  // --- SEARCH (Chats / Friends) ---
  const [chatQuery, setChatQuery] = useState("");
  const [friendQuery, setFriendQuery] = useState("");

  const norm = (s) =>
    String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  const filteredChats = useMemo(() => {
    const q = norm(chatQuery);
    const list = Array.isArray(chats) ? chats : [];
    if (!q) return list;
    return list.filter((c) => norm(c?.name).includes(q));
  }, [chats, chatQuery]);

  // ✅ Sort friends: online first, then name
  const sortedFriends = useMemo(() => {
    const list = Array.isArray(friends) ? [...friends] : [];
    list.sort((a, b) => {
      const ao = a?.status === "online" ? 0 : 1;
      const bo = b?.status === "online" ? 0 : 1;
      if (ao !== bo) return ao - bo;

      const an = String(a?.name || "");
      const bn = String(b?.name || "");
      const byName = an.localeCompare(bn, "vi", { sensitivity: "base" });
      if (byName !== 0) return byName;

      return String(a?.id || "").localeCompare(String(b?.id || ""));
    });
    return list;
  }, [friends]);

  const filteredFriends = useMemo(() => {
    const q = norm(friendQuery);
    if (!q) return sortedFriends;
    return sortedFriends.filter((f) => norm(f?.name).includes(q));
  }, [sortedFriends, friendQuery]);

  const notiRef = useRef(null);

  useEffect(() => {
    const onDown = (e) => {
      if (!notificationsOpen) return;
      const el = notiRef.current;
      if (!el) return;
      if (!el.contains(e.target)) onCloseNotifications?.();
    };

    const onEsc = (e) => {
      if (!notificationsOpen) return;
      if (e.key === "Escape") onCloseNotifications?.();
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [notificationsOpen, onCloseNotifications]);

  return (
    <aside className="w-[400px] shrink-0 border-r border-zinc-200 bg-white flex">
      {/* LEFT NAV */}
      <div className="w-[92px] bg-zinc-900 text-white flex flex-col items-center py-4 gap-3">
        <button
          onClick={onProfile}
          className=" w-12 h-12 rounded-full overflow-hidden cursor-pointer transition outline-none focus:outline-none focus:ring-0  hover:bg-white/10 hover:shadow-[0_0_0_3px_rgba(255,255,255,0.25)]"
          title="Profile"
          type="button"
        >
          <img
            src={me?.avatar}
            alt="me"
            className="object-cover w-full h-full"
          />
        </button>

        <div className="w-full px-3 mt-2 space-y-2">
          <NavButton
            active={tab === "chats"}
            label="All chats"
            badge={totalUnread}
            onClick={() => setTab("chats")}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M21 14a4 4 0 0 1-4 4H8l-5 3V6a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          </NavButton>

          <NavButton
            active={tab === "friends"}
            label="Friends"
            badge={0}
            onClick={() => setTab("friends")}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle
                cx="9"
                cy="7"
                r="4"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M23 21v-2a4 4 0 0 0-3-3.87"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M16 3.13a4 4 0 0 1 0 7.75"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </NavButton>
        </div>

        <div className="w-full px-3 mt-auto space-y-2">
          <NavButton
            active={false}
            label="Profile"
            badge={0}
            onClick={onProfile}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M20 21a8 8 0 1 0-16 0"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle
                cx="12"
                cy="7"
                r="4"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
          </NavButton>

          <NavButton active={false} label="Logout" badge={0} onClick={onLogout}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M10 17l5-5-5-5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M15 12H3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M21 3v18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </NavButton>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center justify-between h-16 px-4 bg-white border-b border-zinc-200">
          <div className="min-w-0">
            <p className="font-semibold truncate text-zinc-900">
              {tab === "chats" ? "Chats" : "Friends"}
            </p>
            <p className="text-xs truncate text-zinc-500">{me?.email}</p>
          </div>

          <div className="relative flex items-center gap-2">
            <IconBtn onClick={onFindFriend} title="Find friend">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle
                  cx="11"
                  cy="11"
                  r="7"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M21 21l-4.3-4.3"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </IconBtn>

            <IconBtn onClick={onCreateGroup} title="Create group chat">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <circle
                  cx="9"
                  cy="7"
                  r="4"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M23 21v-2a4 4 0 0 0-3-3.87"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M16 3.13a4 4 0 0 1 0 7.75"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </IconBtn>

            <div ref={notiRef} className="relative">
              <IconBtn
                onClick={onToggleNotifications}
                title="Notifications"
                badge={notificationsCount}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M13.73 21a2 2 0 0 1-3.46 0"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </IconBtn>

              {notificationsOpen && (
                <NotificationsDropdown
                  items={notifications}
                  meId={me?.id}
                  onClose={onCloseNotifications}
                  onAccept={onAcceptRequest}
                  onReject={onRejectRequest}
                  onClearAll={onClearAllNotifications}
                />
              )}
            </div>
          </div>
        </div>

        {/* SEARCH BAR */}
        <div className="px-4 py-2 border-b border-zinc-200">
          {tab === "chats" ? (
            <div className="relative">
              <input
                value={chatQuery}
                onChange={(e) => setChatQuery(e.target.value)}
                placeholder="Search chats..."
                className="w-full h-10 px-3 pr-10 text-sm border outline-none rounded-xl border-zinc-200 focus:ring-2 focus:ring-violet-200"
              />
              {chatQuery ? (
                <button
                  type="button"
                  onClick={() => setChatQuery("")}
                  className="absolute grid w-8 h-8 -translate-y-1/2 rounded-lg cursor-pointer text-zinc-500 right-1 top-1/2 hover:bg-zinc-100 place-items-center"
                  title="Clear"
                >
                  ✕
                </button>
              ) : null}
            </div>
          ) : (
            <div className="relative">
              <input
                value={friendQuery}
                onChange={(e) => setFriendQuery(e.target.value)}
                placeholder="Search friends..."
                className="w-full h-10 px-3 pr-10 text-sm border outline-none rounded-xl border-zinc-200 focus:ring-2 focus:ring-violet-200"
              />
              {friendQuery ? (
                <button
                  type="button"
                  onClick={() => setFriendQuery("")}
                  className="absolute grid w-8 h-8 -translate-y-1/2 rounded-lg text-zinc-500 right-1 top-1/2 hover:bg-zinc-100 place-items-center"
                  title="Clear"
                >
                  ✕
                </button>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {tab === "chats" ? (
            <div className="p-2 space-y-1">
              {filteredChats.length ? (
                filteredChats.map((c) => {
                  const active = c.id === activeChatId;
                  return (
                    <ChatItem
                      key={c.id}
                      c={c}
                      active={active}
                      onSelectChat={onSelectChat}
                      onViewProfile={onViewProfile}
                      onDeleteChat={onDeleteChat}
                      onReport={onReport}
                    />
                  );
                })
              ) : (
                <div className="px-3 py-6 text-sm text-center text-zinc-500">
                  No chats found.
                </div>
              )}
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredFriends.length ? (
                filteredFriends.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center w-full gap-3 p-3 transition cursor-pointer rounded-2xl hover:bg-zinc-50"
                    role="button"
                    tabIndex={0}
                    title="Open chat"
                    onClick={() => onMessageFriend?.(String(f.id))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onMessageFriend?.(String(f.id));
                      }
                    }}
                  >
                    <div className="relative">
                      <img
                        src={f.avatar}
                        alt={f.name}
                        className="object-cover w-11 h-11 rounded-2xl"
                      />
                      <span className="absolute grid w-5 h-5 bg-white rounded-full -right-1 -bottom-1 place-items-center ring-1 ring-zinc-200">
                        <Dot online={f.status === "online"} />
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate text-zinc-900">
                        {f.name}
                      </p>
                      <p className="text-xs text-zinc-500">{f.status}</p>
                    </div>

                    <button
                      className="text-xs font-semibold text-violet-700 hover:text-violet-800"
                      type="button"
                      title="Message"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMessageFriend?.(String(f.id));
                      }}
                    >
                      Message
                    </button>
                  </div>
                ))
              ) : (
                <div className="px-3 py-6 text-sm text-center text-zinc-500">
                  No friends found.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
