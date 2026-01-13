// src/components/chat/ChatWindow/ChatWindowHeader.jsx
import Icon from "./Icon.jsx";

export default function ChatWindowHeader({
  title,
  subtitle,
  chat,
  isSearchOpen,
  onToggleSearch,
  isInfoOpen,
  onToggleInfo,

  // search props
  searchInput,
  setSearchInput,
  searchInputRef,
  isSearching,
  debouncedQuery,
  matchIds,
  matchPos,
  setMatchPos,
}) {
  return (
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
  );
}
