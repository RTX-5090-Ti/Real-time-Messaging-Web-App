// src/components/chat/ChatWindow/NewMessagesToast.jsx
export default function NewMessagesToast({ newMsgCount, onClick }) {
  if (!newMsgCount) return null;

  return (
    <div className="sticky z-50 flex justify-center pointer-events-none bottom-4">
      <button
        type="button"
        onClick={onClick}
        className="pointer-events-auto px-3 py-1.5 text-sm rounded-full bg-zinc-900 text-white shadow cursor-pointer"
      >
        New messages ({newMsgCount})
      </button>
    </div>
  );
}
