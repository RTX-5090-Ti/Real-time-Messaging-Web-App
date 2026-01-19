// src/components/chat/ChatWindow/SeenByRow.jsx
// import { useMemo } from "react";
import { avatarFromName } from "../../../utils/chatUi.js";

export default function SeenByRow({ seenKey, seenBy = [], users }) {
  // ✅ backward compatible: hỗ trợ cả users lẫn seenBy
  const list = (users && users.length ? users : seenBy) || [];
  if (!list.length) return null;

  const display = list.slice(0, 3);
  const extra = list.length - display.length;

  const getAvatar = (u) =>
    u?.avatar || u?.avatarUrl || avatarFromName(u?.name || "User");

  const names = list.map((u) => u?.name || "User");
  const seenNames =
    names.length <= 8
      ? names.join(", ")
      : `${names.slice(0, 8).join(", ")} and ${names.length - 8} others`;

  return (
    <div className="relative flex justify-end mt-[10px]">
      {/* ✅ group hover wrapper */}
      <div
        key={seenKey || list.map((u) => u?.id || u?.userId).join(",")}
        className="relative flex items-center gap-2 pr-2 group animate-[fadeInUp_.18s_ease-out]"
      >
        {/* avatar stack */}
        <div className="flex -space-x-2">
          {display.map((u) => (
            <img
              key={u.id || u.userId}
              src={getAvatar(u)}
              alt={u.name}
              className="object-cover w-5 h-5 rounded-full shadow-sm ring-2 ring-white"
            />
          ))}

          {extra > 0 ? (
            <span className="grid w-5 h-5 text-[10px] font-semibold bg-white rounded-full ring-2 ring-white shadow-sm place-items-center text-zinc-600">
              +{extra}
            </span>
          ) : null}
        </div>

        {/* ✅ tooltip hover */}
        <div
          className={[
            "pointer-events-none absolute bottom-full right-0 mb-2 ",
            "opacity-0 translate-y-1 scale-95",
            "group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100",
            "transition-all duration-150 z-50",
          ].join(" ")}
        >
          <div className="px-3 py-2 text-xs text-white shadow-lg w-max max-w-none rounded-xl bg-zinc-900">
            <div className="mb-1 font-medium">Seen by</div>
            <div className="leading-5 text-zinc-200">{seenNames}</div>
          </div>

          {/* arrow */}
          <div className="absolute w-2 h-2 rotate-45 right-3 top-full bg-zinc-900" />
        </div>
      </div>
    </div>
  );
}
