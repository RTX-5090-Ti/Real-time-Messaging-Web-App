import mongoose from "mongoose";
import { authSocket } from "./authSocket.js";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";

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

function upsertLastRead(convo, userId, at) {
  convo.participants = convo.participants || [];
  const uid = userId.toString();
  const idx = convo.participants.findIndex((p) => p.userId?.toString() === uid);
  if (idx === -1) convo.participants.push({ userId, lastReadAt: at, clearedAt: null });
  else convo.participants[idx].lastReadAt = at;
}

export function initSocket(io) {
  io.use(authSocket);

  io.on("connection", (socket) => {
    const userId = socket.user.id;
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

    // join vào 1 conversation
    socket.on("conversation:join", async (conversationId) => {
      if (!mongoose.Types.ObjectId.isValid(conversationId)) return;

      const convo = await Conversation.findById(conversationId).select(
        "members"
      );
      if (!convo) return;

      const isMember = convo.members.some((m) => m.toString() === userId);
      if (!isMember) return;

      // ✅ chỉ join room để nhận typing/instant-seen check
      socket.join(conversationId);

      socket.emit("conversation:joined", { conversationId });
    });

    socket.on("conversation:leave", (conversationId) => {
      socket.leave(conversationId);
    });

    // ✅ Client explicitly marks a conversation as read (open chat)
    socket.on("conversation:read", async (payload = {}) => {
      // console.log("READ EVENT:", socket.id, payload);

      const cid =
        typeof payload === "string" || typeof payload === "number"
          ? String(payload)
          : payload?.conversationId
          ? String(payload.conversationId)
          : null;

      const atISO =
        typeof payload === "object" && payload?.at
          ? payload.at
          : new Date().toISOString();

      if (!cid) return;
      if (!mongoose.Types.ObjectId.isValid(cid)) return;

      const convo = await Conversation.findById(cid).select(
        "members participants"
      );
      if (!convo) return;

      const isMember = convo.members.some((m) => m.toString() === userId);
      if (!isMember) return;

      const readAt = new Date(atISO);

      upsertLastRead(convo, new mongoose.Types.ObjectId(userId), readAt);
      await convo.save();

      for (const memberId of convo.members) {
        const mid = memberId.toString();
        if (mid === userId.toString()) continue;

        io.to(`user:${mid}`).emit("conversation:read", {
          conversationId: cid,
          userId,
          at: readAt,
        });
      }
    });

    // Đang Typing (gõ)
    socket.on("typing:start", async ({ conversationId }) => {
      if (!mongoose.Types.ObjectId.isValid(conversationId)) return;

      const convo = await Conversation.findById(conversationId).select(
        "members"
      );
      if (!convo) return;

      const isMember = convo.members.some((m) => m.toString() === userId);
      if (!isMember) return;

      socket.to(conversationId).emit("typing:update", {
        conversationId,
        userId,
        name: socket.user.name,
        typing: true,
      });
    });

    socket.on("typing:stop", async ({ conversationId }) => {
      if (!mongoose.Types.ObjectId.isValid(conversationId)) return;

      const convo = await Conversation.findById(conversationId).select(
        "members"
      );
      if (!convo) return;

      const isMember = convo.members.some((m) => m.toString() === userId);
      if (!isMember) return;

      socket.to(conversationId).emit("typing:update", {
        conversationId,
        userId,
        name: socket.user.name,
        typing: false,
      });
    });

    socket.on(
      "message:send",
      async ({ conversationId, text, attachments, clientId }, ack) => {
        if (!mongoose.Types.ObjectId.isValid(conversationId)) return;

        const convo = await Conversation.findById(conversationId);
        if (!convo) return;

        const isMember = convo.members.some((m) => m.toString() === userId);
        if (!isMember) return;

        const trimmed = String(text || "").trim();
        const safeAttachments = Array.isArray(attachments)
          ? attachments
              .filter((a) => a && typeof a.url === "string" && a.url)
              .map((a) => {
                const base = {
                  kind: a.kind,
                  url: a.url,
                  name: a.name || "",
                  mime: a.mime || "",
                  size: Number(a.size) || 0,
                };

                if (a.kind === "gif") {
                  return {
                    ...base,
                    provider: a.provider || "",
                    gifId: a.gifId || "",
                    preview: a.preview || "",
                    width: Number(a.width) || 0,
                    height: Number(a.height) || 0,
                    mp4: a.mp4 || "",
                  };
                }

                return base;
              })
          : [];

        if (!trimmed && safeAttachments.length === 0) return;

        const msg = await Message.create({
          conversationId,
          senderId: userId,
          text: trimmed,
          attachments: safeAttachments,
        });

        convo.lastMessageAt = new Date();
        upsertLastRead(convo, new mongoose.Types.ObjectId(userId), new Date());
        await convo.save();

        // If anyone previously deleted/cleared the chat, a new message should make it appear again
        // (their message history is still filtered by participant.clearedAt)
        try {
          await Conversation.updateOne(
            { _id: conversationId },
            { $pull: { hiddenFor: { $in: convo.members } } }
          );
        } catch (e) {}

        const payload = {
          conversationId,
          id: msg._id,
          text: msg.text,
          attachments: (msg.attachments || []).map((a) => ({
            kind: a.kind,
            url: a.url,
            name: a.name,
            mime: a.mime,
            size: a.size,

            // gif metadata (URL-only)
            provider: a.provider || "",
            gifId: a.gifId || "",
            preview: a.preview || "",
            width: a.width || 0,
            height: a.height || 0,
            mp4: a.mp4 || "",
          })),
          sender: {
            id: socket.user.id,
            name: socket.user.name,
          },
          createdAt: msg.createdAt,
          clientId: clientId || null,
        };

        ack?.({ ok: true, id: String(msg._id), createdAt: msg.createdAt });

        // ✅ Send to ALL members via user rooms
        // => FE không cần join tất cả conversations nữa, và không bị duplicate (room + user-room)
        for (const memberId of convo.members) {
          io.to(`user:${memberId.toString()}`).emit("message:new", payload);
        }

        // ✅ Instant "Seen" if other member is currently in the room (basic Messenger behavior)
        try {
          const room = io.sockets.adapter.rooms.get(conversationId);
          if (room) {
            const viewers = new Set(); // userIds currently viewing this conversation
            for (const sid of room) {
              const s = io.sockets.sockets.get(sid);
              const uid = s?.user?.id;
              if (!uid) continue;
              if (String(uid) === String(userId)) continue; // skip sender
              viewers.add(String(uid));
            }

            if (viewers.size > 0) {
              const at = msg.createdAt;

              // update lastReadAt for viewers
              for (const uid of viewers) {
                upsertLastRead(convo, new mongoose.Types.ObjectId(uid), at);

                // notify sender even if sender is not in the conversation room
                io.to(`user:${userId}`).emit("conversation:read", {
                  conversationId,
                  userId: uid, // the viewer who read it
                  at,
                });
              }

              await convo.save();
            }
          }
        } catch (err) {
          console.warn("instant seen failed:", err?.message || err);
        }

        // Dừng typing for sender (optional)
        socket.to(conversationId).emit("typing:update", {
          conversationId,
          userId,
          name: socket.user.name,
          typing: false,
        });
      }
    );

    socket.on("disconnect", () => {
      const becameOffline = removeOnline(userId, socket.id);
      if (becameOffline) {
        io.emit("presence:update", { userId, online: false });
      }
      console.log("🔴 Socket disconnected:", socket.user.name);
    });
  });
}
