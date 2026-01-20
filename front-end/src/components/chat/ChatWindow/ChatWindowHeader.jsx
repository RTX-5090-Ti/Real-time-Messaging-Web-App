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
  onBack,
}) {
  return (
    <div
      className={[
        "border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950",
        "px-3 sm:px-5 py-2 sm:py-0",
        "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2",
        "sm:h-16",
      ].join(" ")}
    >
      {/* Left */}
      <div className="flex items-center min-w-0 gap-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="grid cursor-pointer sm:hidden w-9 h-9 rounded-xl place-items-center hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-100 shrink-0"
            title="Back"
          >
            ←
          </button>
        ) : null}

        <div className="min-w-0">
          <p className="font-semibold truncate text-zinc-900 dark:text-zinc-100">
            {title}
          </p>
          {chat ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>

      {/* Right */}
      <div className="flex flex-col w-full gap-2 sm:w-auto sm:flex-row sm:items-center">
        <div className="flex items-center justify-end gap-2 sm:justify-normal">
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
        </div>

        {isSearchOpen && chat ? (
          <div
            className={[
              "bg-white dark:bg-zinc-950 overflow-hidden",
              "transition-[max-height,opacity,transform] duration-200 ease-out",
              isSearchOpen
                ? "max-h-24 opacity-100 translate-y-0"
                : "max-h-0 opacity-0 -translate-y-1",
            ].join(" ")}
          >
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={searchInput}
                ref={searchInputRef}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search within a conversation"
                className="h-10 px-3 text-sm border outline-none w-full sm:w-[260px] rounded-xl border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:ring-2 focus:ring-violet-200"
                autoFocus
              />

              <div className="shrink-0 w-[72px] text-center text-[11px] text-zinc-500 dark:text-zinc-400 hidden sm:block">
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
                className="flex items-center justify-center h-10 gap-2 px-3 text-sm border cursor-pointer group rounded-xl border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-100 disabled:opacity-50"
                onClick={() =>
                  setMatchPos((p) =>
                    matchIds.length
                      ? (p - 1 + matchIds.length) % matchIds.length
                      : 0,
                  )
                }
                disabled={!matchIds.length}
                title="Previous"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M6 14l6-6 6 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              <button
                type="button"
                className="flex items-center justify-center h-10 gap-2 px-3 text-sm border cursor-pointer group rounded-xl border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-100 disabled:opacity-50"
                onClick={() =>
                  setMatchPos((p) =>
                    matchIds.length ? (p + 1) % matchIds.length : 0,
                  )
                }
                disabled={!matchIds.length}
                title="Next"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M6 10l6 6 6-6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {/* Mobile counter */}
              <div className="w-full text-center text-[11px] text-zinc-500 dark:text-zinc-400 sm:hidden">
                {isSearching
                  ? "Searching…"
                  : !debouncedQuery
                    ? ""
                    : matchIds.length
                      ? `${matchPos + 1}/${matchIds.length}`
                      : "No results"}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
