import { authSocket } from "./authSocket.js";
import { createTypingTracker } from "./typing.js";
import { registerConversationHandlers } from "./conversation.handlers.js";
import { registerMessageHandlers } from "./message.handlers.js";
import { fail } from "../validations/chatPayload.js";
import { limitTyping, limitSocket } from "../middlewares/rateLimit.js";

// userId -> Set(socketId)
const onlineUsers = new Map();

function addOnline(userId, socketId) {
  const key = userId.toString();
  if (!onlineUsers.has(key)) onlineUsers.set(key, new Set());
  onlineUsers.get(key).add(socketId);
}

function removeOnline(userId, socketId) {
  const key = userId.toString();
  const set = onlineUsers.get(key);
  if (!set) return false;
  set.delete(socketId);
  if (set.size === 0) {
    onlineUsers.delete(key);
    return true; // chuyển thành offline
  }
  return false;
}

function getOnlineUserIds() {
  return Array.from(onlineUsers.keys());
}

export function initSocket(io) {
  io.use(authSocket);
  const typing = createTypingTracker(io);
  io.typingTracker = typing;

  io.on("connection", (socket) => {
    const userId = socket.user.id;
    const on = (event, handler) => socket.on(event, async (payload, callback) => {
      let replied = false;
      const ack = (result) => {
        if (replied) return;
        replied = true;
        if (typeof callback === "function") callback(result);
      };
      try {
        limitSocket(String(userId));
        if (event.startsWith("typing:")) limitTyping(String(userId));
        if (!["presence:sync", "conversation:join", "conversation:leave", "conversation:read"].includes(event) &&
            (!payload || typeof payload !== "object" || Array.isArray(payload))) fail("INVALID_PAYLOAD");
        await handler(payload, ack);
        ack({ ok: true });
      } catch (err) {
        if (!err.status) console.error(event, err);
        const error = err.status ? err.message : "SERVER_ERROR";
        ack({ ok: false, error, retryAfter: err.retryAfter });
        if (typeof callback !== "function") socket.emit("operation:error", { event, error });
      }
    });
    // Join user room for direct notifications (read receipts, presence, etc.)
    socket.join(`user:${socket.user.id}`);
    // socket.join(`user:${userId}`);
    console.log("🟢 Socket connected:", socket.user.name);

    // Trạng thái: dánh dấu là online
    addOnline(userId, socket.id);
    // Gửi trạng thái đến socket này
    socket.emit("presence:state", { onlineUserIds: getOnlineUserIds() });
    // Thông báo người này đanh online
    socket.broadcast.emit("presence:update", { userId, online: true });

    on("presence:sync", () => {
      socket.emit("presence:state", { onlineUserIds: getOnlineUserIds() });
    });

    // join vào 1 conversation
    registerConversationHandlers(io, socket, on, typing);
    registerMessageHandlers(socket, on, typing);

    socket.on("disconnect", () => {
      typing.disconnect(socket);
      const becameOffline = removeOnline(userId, socket.id);
      if (becameOffline) {
        io.emit("presence:update", { userId, online: false });
      }
      console.log("🔴 Socket disconnected:", socket.user.name);
    });
  });
}
