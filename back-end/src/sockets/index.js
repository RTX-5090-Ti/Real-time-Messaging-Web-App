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
  if (idx === -1)
    convo.participants.push({ userId, lastReadAt: at, clearedAt: null });
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

    const ALLOWED_REACTIONS = new Set(["❤️", "😆", "😮", "😭", "👍"]);

    socket.on(
      "message:react",
      async ({ conversationId, messageId, emoji }, ack) => {
        try {
          const cid = String(conversationId || "");
          const mid = String(messageId || "");
          const em = String(emoji || "");

          if (!cid || !mongoose.Types.ObjectId.isValid(cid)) return;
          if (!mid || !mongoose.Types.ObjectId.isValid(mid)) return;
          if (!ALLOWED_REACTIONS.has(em)) return;

          const convo = await Conversation.findById(cid).select("members");
          if (!convo) return;

          const isMember = convo.members.some((m) => m.toString() === userId);
          if (!isMember) return;

          const msg = await Message.findById(mid).select(
            "conversationId reactions"
          );
          if (!msg || String(msg.conversationId) !== cid) return;

          const uid = String(userId);
          const idx = (msg.reactions || []).findIndex(
            (r) => String(r.userId) === uid
          );

          if (idx !== -1 && msg.reactions[idx].emoji === em) {
            // toggle off
            msg.reactions.splice(idx, 1);
          } else if (idx !== -1) {
            // replace emoji
            msg.reactions[idx].emoji = em;
            msg.reactions[idx].reactedAt = new Date();
          } else {
            msg.reactions.push({ userId, emoji: em });
          }

          await msg.save();

          const payload = {
            conversationId: cid,
            messageId: mid,
            reactions: (msg.reactions || []).map((r) => ({
              userId: String(r.userId),
              emoji: r.emoji,
            })),
          };

          ack?.({ ok: true });

          for (const memberId of convo.members) {
            io.to(`user:${memberId.toString()}`).emit(
              "message:reaction",
              payload
            );
          }
        } catch (e) {
          console.error("message:react error:", e?.message || e);
          ack?.({ ok: false });
        }
      }
    );

    socket.on(
      "message:edit",
      async ({ conversationId, messageId, text }, ack) => {
        try {
          const cid = String(conversationId || "");
          const mid = String(messageId || "");
          const trimmed = String(text || "").trim();

          if (!cid || !mongoose.Types.ObjectId.isValid(cid))
            return ack?.({ ok: false, error: "INVALID_CID" });
          if (!mid || !mongoose.Types.ObjectId.isValid(mid))
            return ack?.({ ok: false, error: "INVALID_MID" });
          if (!trimmed) return ack?.({ ok: false, error: "EMPTY_TEXT" });

          const convo = await Conversation.findById(cid).select("members");
          if (!convo) return ack?.({ ok: false, error: "NO_CONVO" });

          const isMember = convo.members.some((m) => m.toString() === userId);
          if (!isMember) return ack?.({ ok: false, error: "FORBIDDEN" });

          const msg = await Message.findById(mid).select(
            "conversationId senderId isRecalled"
          );
          if (!msg || String(msg.conversationId) !== cid)
            return ack?.({ ok: false, error: "NO_MSG" });

          if (String(msg.senderId) !== String(userId))
            return ack?.({ ok: false, error: "NOT_OWNER" });
          if (msg.isRecalled) return ack?.({ ok: false, error: "RECALLED" });

          msg.text = trimmed;
          msg.editedAt = new Date();
          await msg.save();

          const payload = {
            conversationId: cid,
            messageId: mid,
            text: msg.text,
            editedAt: msg.editedAt,
          };

          ack?.({ ok: true });

          for (const memberId of convo.members) {
            io.to(`user:${memberId.toString()}`).emit(
              "message:edited",
              payload
            );
          }
        } catch (e) {
          console.error("message:edit error:", e?.message || e);
          ack?.({ ok: false, error: "SERVER_ERROR" });
        }
      }
    );

    socket.on("message:recall", async ({ conversationId, messageId }, ack) => {
      try {
        const cid = String(conversationId || "");
        const mid = String(messageId || "");

        if (!cid || !mongoose.Types.ObjectId.isValid(cid))
          return ack?.({ ok: false, error: "INVALID_CID" });
        if (!mid || !mongoose.Types.ObjectId.isValid(mid))
          return ack?.({ ok: false, error: "INVALID_MID" });

        const convo = await Conversation.findById(cid).select("members");
        if (!convo) return ack?.({ ok: false, error: "NO_CONVO" });

        const isMember = convo.members.some((m) => m.toString() === userId);
        if (!isMember) return ack?.({ ok: false, error: "FORBIDDEN" });

        const msg = await Message.findById(mid).select(
          "conversationId senderId"
        );
        if (!msg || String(msg.conversationId) !== cid)
          return ack?.({ ok: false, error: "NO_MSG" });

        if (String(msg.senderId) !== String(userId))
          return ack?.({ ok: false, error: "NOT_OWNER" });

        msg.text = "Đã thu hồi tin nhắn";
        msg.attachments = [];
        msg.reactions = [];
        msg.isRecalled = true;
        msg.recalledAt = new Date();
        msg.recalledBy = new mongoose.Types.ObjectId(userId);
        await msg.save();

        const payload = {
          conversationId: cid,
          messageId: mid,
          text: msg.text,
          attachments: [],
          reactions: [],
          isRecalled: true,
          recalledAt: msg.recalledAt,
          recalledBy: String(userId),
        };

        ack?.({ ok: true });

        for (const memberId of convo.members) {
          io.to(`user:${memberId.toString()}`).emit(
            "message:recalled",
            payload
          );
        }
      } catch (e) {
        console.error("message:recall error:", e?.message || e);
        ack?.({ ok: false, error: "SERVER_ERROR" });
      }
    });

    socket.on("message:pin", async ({ conversationId, messageId }, ack) => {
      try {
        const cid = String(conversationId || "");
        const mid = String(messageId || "");

        if (!cid || !mongoose.Types.ObjectId.isValid(cid))
          return ack?.({ ok: false, error: "INVALID_CID" });
        if (!mid || !mongoose.Types.ObjectId.isValid(mid))
          return ack?.({ ok: false, error: "INVALID_MID" });

        const convo = await Conversation.findById(cid).select("members");
        if (!convo) return ack?.({ ok: false, error: "NO_CONVO" });

        const isMember = convo.members.some((m) => m.toString() === userId);
        if (!isMember) return ack?.({ ok: false, error: "FORBIDDEN" });

        const msg = await Message.findById(mid).select(
          "conversationId pinned pinnedAt pinnedBy"
        );
        if (!msg || String(msg.conversationId) !== cid)
          return ack?.({ ok: false, error: "NO_MSG" });

        const nextPinned = !msg.pinned;
        msg.pinned = nextPinned;
        msg.pinnedAt = nextPinned ? new Date() : null;
        msg.pinnedBy = nextPinned ? new mongoose.Types.ObjectId(userId) : null;
        await msg.save();

        const payload = {
          conversationId: cid,
          messageId: mid,
          pinned: msg.pinned,
          pinnedAt: msg.pinnedAt,
          pinnedBy: msg.pinnedBy ? String(msg.pinnedBy) : null,
        };

        ack?.({ ok: true });

        for (const memberId of convo.members) {
          io.to(`user:${memberId.toString()}`).emit("message:pinned", payload);
        }
      } catch (e) {
        console.error("message:pin error:", e?.message || e);
        ack?.({ ok: false, error: "SERVER_ERROR" });
      }
    });

    socket.on(
      "message:send",
      async ({ conversationId, text, attachments, clientId, replyTo }, ack) => {
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

        let replyMsg = null;
        if (replyTo) {
          if (!mongoose.Types.ObjectId.isValid(replyTo)) return;
          replyMsg = await Message.findById(replyTo)
            .select("_id text senderId attachments createdAt conversationId")
            .populate("senderId", "_id name");
          if (
            !replyMsg ||
            String(replyMsg.conversationId) !== String(conversationId)
          )
            return;
        }

        const msg = await Message.create({
          conversationId,
          senderId: userId,
          text: trimmed,
          attachments: safeAttachments,
          replyTo: replyMsg ? replyMsg._id : null,
        });

        if (replyMsg) {
          await msg.populate({
            path: "replyTo",
            select: "_id text senderId attachments createdAt",
            populate: { path: "senderId", select: "_id name" },
          });
        }

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
          replyTo: msg.replyTo
            ? {
                id: msg.replyTo._id,
                text: msg.replyTo.text,
                attachments: (msg.replyTo.attachments || []).map((a) => ({
                  kind: a.kind,
                  url: a.url,
                  name: a.name,
                  mime: a.mime,
                  size: a.size,
                  provider: a.provider || "",
                  gifId: a.gifId || "",
                  preview: a.preview || "",
                  width: a.width || 0,
                  height: a.height || 0,
                  mp4: a.mp4 || "",
                })),
                sender: msg.replyTo.senderId
                  ? {
                      id: msg.replyTo.senderId._id,
                      name: msg.replyTo.senderId.name,
                    }
                  : null,
                createdAt: msg.replyTo.createdAt,
              }
            : null,

          reactions: [],

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
