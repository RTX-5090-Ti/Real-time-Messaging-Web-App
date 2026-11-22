import { visibleReadCandidate } from "../../utils/chat/readVisibility.js";
import { useEffect, useRef } from "react";
import { socket } from "../../socket/socket.js";

export function useVisibleRead({ conversationId, messages, listRef }) {
  const acknowledged = useRef(new Map());
  useEffect(() => {
    const root = listRef.current;
    if (!conversationId || !root) return;
    let disposed = false;
    let timer;
    let inFlight = false;
    const check = () => {
      if (disposed || !socket.connected || inFlight) return;
      const id = visibleReadCandidate(root.getBoundingClientRect(),
        [...root.querySelectorAll("[data-msg-id]")].map(el => ({ id: el.dataset.msgId, rect: el.getBoundingClientRect() })),
        document.visibilityState === "visible", document.hasFocus());
      if (!id || acknowledged.current.get(conversationId) === id) return;
      inFlight = true;
      socket.timeout(5000).emit("conversation:read", { conversationId, messageId: id }, (error, result) => {
        inFlight = false;
        if (!error && result?.ok) acknowledged.current.set(conversationId, id);
        if (!disposed) schedule();
      });
    };
    const schedule = () => { clearTimeout(timer); timer = setTimeout(check, 250); };
    const reconnect = () => { acknowledged.current.delete(conversationId); schedule(); };
    root.addEventListener("scroll", schedule);
    window.addEventListener("focus", schedule);
    window.addEventListener("resize", schedule);
    document.addEventListener("visibilitychange", schedule);
    socket.on("connect", reconnect);
    const observer = new ResizeObserver(schedule);
    observer.observe(root);
    schedule();
    return () => {
      disposed = true;
      clearTimeout(timer);
      observer.disconnect();
      root.removeEventListener("scroll", schedule);
      window.removeEventListener("focus", schedule);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("visibilitychange", schedule);
      socket.off("connect", reconnect);
    };
  }, [conversationId, messages, listRef]);
}
