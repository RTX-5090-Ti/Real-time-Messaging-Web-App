import React from "react";

export const typingIndicatorCss = `
@keyframes dotPulse {
  0%, 80%, 100% { transform: translateY(0); opacity: .35; }
  40% { transform: translateY(-4px); opacity: 1; }
}
.typing-dot {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background: #71717a; /* zinc-500 */
  display: inline-block;
  animation: dotPulse 1.1s infinite ease-in-out;
}
.typing-dot:nth-child(2) { animation-delay: .15s; }
.typing-dot:nth-child(3) { animation-delay: .3s; }
`;

export default function TypingIndicator({ avatar, name, show, text }) {
  return (
    <>
      <style>{typingIndicatorCss}</style>

      <div
        className={[
          "flex items-end gap-3",
          "transition-all duration-200 ease-out",
          show
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-1 pointer-events-none",
        ].join(" ")}
        aria-hidden={!show}
      >
        <img
          src={avatar}
          alt={name}
          className="object-cover w-8 h-8 rounded-full"
          title={name}
        />
        <div className="px-4 py-3 bg-white border shadow-sm rounded-2xl border-zinc-200">
          {text ? (
            <div className="mb-1 text-xs font-medium text-zinc-600">{text}</div>
          ) : null}

          <div className="flex items-center gap-1">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
        </div>
      </div>
    </>
  );
}
