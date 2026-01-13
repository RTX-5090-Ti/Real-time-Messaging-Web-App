// src/components/chat/ChatWindow/SeenByRow.jsx
export default function SeenByRow({ seenKey, seenBy = [] }) {
  return (
    <div className="flex justify-end mt-[10px]">
      <div
        key={seenKey}
        className="flex items-center gap-2 pr-2 animate-[fadeInUp_.18s_ease-out]"
      >
        <div className="flex -space-x-2">
          {seenBy.slice(0, 3).map((u) => (
            <img
              key={u.id}
              src={u.avatar}
              alt={u.name}
              title={`Seen by ${u.name}`}
              className="object-cover w-5 h-5 rounded-full shadow-sm ring-2 ring-white"
            />
          ))}
          {seenBy.length > 3 ? (
            <span className="grid w-5 h-5 text-[10px] font-semibold bg-white rounded-full ring-2 ring-white shadow-sm place-items-center text-zinc-600">
              +{seenBy.length - 3}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
