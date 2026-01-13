// src/components/chat/ChatWindow/Icon.jsx
export default function Icon({ children, tooltip, onClick, active }) {
  return (
    <div className="relative">
      <span className="inline-flex group">
        <button
          type="button"
          onClick={onClick}
          className={[
            "inline-flex items-center justify-center transition cursor-pointer h-10 w-10 rounded-xl",
            active ? "bg-violet-50 text-violet-700" : "hover:bg-zinc-100",
          ].join(" ")}
          aria-pressed={!!active}
          title={tooltip}
        >
          {children}
        </button>
      </span>
    </div>
  );
}
