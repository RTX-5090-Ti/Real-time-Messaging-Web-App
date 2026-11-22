// Each tab owns its own TTL. Stopping one tab never stops another tab's typing.
export function createTypingTracker(io, ttl = 4500) {
  const rooms = new Map();
  const emit = (cid, user, typing) => io.to(cid).emit("typing:update", {
    conversationId: cid, userId: user.id, name: user.name, avatarUrl: user.avatarUrl || null, typing,
  });
  function stop(cid, socket) {
    const key = `${cid}:${socket.user.id}`;
    const entry = rooms.get(key);
    if (!entry) return;
    clearTimeout(entry.sockets.get(socket.id));
    entry.sockets.delete(socket.id);
    if (!entry.sockets.size) { rooms.delete(key); emit(cid, socket.user, false); }
  }
  return {
    start(cid, socket) {
      const key = `${cid}:${socket.user.id}`;
      let entry = rooms.get(key);
      if (!entry) { entry = { cid, user: socket.user, sockets: new Map() }; rooms.set(key, entry); }
      clearTimeout(entry.sockets.get(socket.id));
      const timer = setTimeout(() => stop(cid, socket), ttl);
      timer.unref?.();
      entry.sockets.set(socket.id, timer);
      emit(cid, socket.user, true);
    },
    stop,
    disconnect(socket) {
      for (const entry of rooms.values()) if (entry.sockets.has(socket.id)) stop(entry.cid, socket);
    },
    removeUser(cid, userId) {
      const entry = rooms.get(`${cid}:${userId}`);
      if (!entry) return;
      for (const timer of entry.sockets.values()) clearTimeout(timer);
      rooms.delete(`${cid}:${userId}`);
      emit(cid, entry.user, false);
    },
  };
}
