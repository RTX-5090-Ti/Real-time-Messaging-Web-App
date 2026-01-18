import mongoose from "mongoose";

import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";

function upsertLastRead(convo, userId, at) {
  convo.participants = convo.participants || [];
  const idx = convo.participants.findIndex(
    (p) => p.userId?.toString() === userId.toString(),
  );
  if (idx === -1) {
    convo.participants.push({ userId, lastReadAt: at, clearedAt: null });
  } else {
    convo.participants[idx].lastReadAt = at;
  }
}

function toClientAttachment(a) {
  return {
    kind: a.kind,
    url: a.url,
    name: a.name,
    mime: a.mime,
    size: a.size,

    // gif url-only fields
    provider: a.provider || "",
    gifId: a.gifId || "",
    preview: a.preview || "",
    width: a.width || 0,
    height: a.height || 0,
    mp4: a.mp4 || "",
  };
}

function sanitizeAttachment(a) {
  const kind = a?.kind;
  const url = typeof a?.url === "string" ? a.url.trim() : "";

  if (!kind || !url) return null;

  const base = {
    kind,
    url,
    name: a?.name || "",
    mime: a?.mime || "",
    size: Number(a?.size) || 0,
  };

  if (kind === "gif") {
    return {
      ...base,
      provider: String(a?.provider || "").trim(), // validated by rules
      gifId: String(a?.gifId || "").trim(),
      preview: String(a?.preview || "").trim(),
      width: Number(a?.width) || 0,
      height: Number(a?.height) || 0,
      mp4: String(a?.mp4 || "").trim(),
    };
  }

  // image/file/sticker keep base
  return base;
}

// Lấy danh sách tin nhắn của 1 conversation
export async function getMessages(req, res) {
  const { conversationId, before, limit } = req.query;
  const myId = req.user.id;

  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    return res.status(400).json({ message: "conversationId không hợp lệ" });
  }

  const convo = await Conversation.findById(conversationId);
  if (!convo)
    return res.status(404).json({ message: "Conversation không tồn tại" });

  const isMember = convo.members.some((m) => m.toString() === myId);
  if (!isMember)
    return res.status(403).json({ message: "Không có quyền truy cập" });

  const pageSize = Math.min(Math.max(parseInt(limit || "30", 10), 1), 100);

  // Messenger-style "delete/clear chat": hide messages older than clearedAt for this user
  const myP = (convo.participants || []).find(
    (p) => p.userId?.toString() === myId.toString(),
  );
  const clearedAt = myP?.clearedAt ? new Date(myP.clearedAt) : null;

  const findQuery = { conversationId };
  const createdAtCond = {};

  if (clearedAt && !Number.isNaN(clearedAt.getTime())) {
    createdAtCond.$gt = clearedAt;
  }

  if (before) {
    const d = new Date(before);
    if (!Number.isNaN(d.getTime())) {
      createdAtCond.$lt = d;
    }
  }

  if (Object.keys(createdAtCond).length) {
    findQuery.createdAt = createdAtCond;
  }

  // lấy newest->older, limit+1 để biết có còn nữa không
  const docs = await Message.find(findQuery)
    .sort({ createdAt: -1 })
    .limit(pageSize + 1)
    .populate("senderId", "_id name avatar")
    .populate({
      path: "replyTo",
      select: "_id text senderId attachments createdAt",
      populate: { path: "senderId", select: "_id name avatar" },
    });

  const hasMore = docs.length > pageSize;
  const page = (hasMore ? docs.slice(0, pageSize) : docs).reverse(); // trả về oldest->newest cho UI

  const nextBefore = page.length ? page[0].createdAt : null;

  return res.json({
    messages: page.map((m) => ({
      kind: m.kind || "user",
      id: m._id,
      text: m.text,
      system: m.system || null,
      attachments: (m.attachments || []).map(toClientAttachment),
      sender: m.senderId
        ? {
            id: m.senderId._id,
            name: m.senderId.name,
            avatarUrl: m.senderId.avatar?.url || null,
          }
        : null,
      createdAt: m.createdAt,
      replyTo: m.replyTo
        ? {
            id: m.replyTo._id,
            text: m.replyTo.text,
            attachments: (m.replyTo.attachments || []).map(toClientAttachment),
            sender: m.replyTo.senderId
              ? {
                  id: m.replyTo.senderId._id,
                  name: m.replyTo.senderId.name,
                  avatarUrl: m.replyTo.senderId.avatar?.url || null,
                }
              : null,
            createdAt: m.replyTo.createdAt,
          }
        : null,

      reactions: Array.isArray(m.reactions)
        ? m.reactions.map((r) => ({ userId: String(r.userId), emoji: r.emoji }))
        : [],
      pinned: !!m.pinned,
      pinnedAt: m.pinnedAt,
      pinnedBy: m.pinnedBy ? String(m.pinnedBy) : null,

      editedAt: m.editedAt,
      isRecalled: !!m.isRecalled,
      recalledAt: m.recalledAt,
      recalledBy: m.recalledBy ? String(m.recalledBy) : null,
    })),
    hasMore,
    nextBefore, // FE dùng làm cursor
  });
}

// Gửi tin nhắn
export async function sendMessage(req, res) {
  const { conversationId, text, attachments, replyTo } = req.body;
  const myId = req.user.id;

  const convo = await Conversation.findOne({
    _id: conversationId,
    members: myId,
  });
  if (!convo)
    return res.status(403).json({ message: "không có quyền gửi tin" });

  const trimmed = String(text || "").trim();

  const safeAttachments = Array.isArray(attachments)
    ? attachments.map(sanitizeAttachment).filter(Boolean)
    : [];

  if (!trimmed && safeAttachments.length === 0) {
    return res.status(400).json({ message: "text or attachments is required" });
  }

  let replyDoc = null;
  if (replyTo) {
    if (!mongoose.Types.ObjectId.isValid(replyTo)) {
      return res.status(400).json({ message: "replyTo không hợp lệ" });
    }
    replyDoc = await Message.findById(replyTo).select("conversationId");
    if (
      !replyDoc ||
      String(replyDoc.conversationId) !== String(conversationId)
    ) {
      return res
        .status(400)
        .json({ message: "replyTo không tồn tại trong conversation này" });
    }
  }

  const msg = await Message.create({
    conversationId,
    senderId: myId,
    text: trimmed,
    attachments: safeAttachments,
    replyTo: replyTo || null,
  });

  await msg.populate("senderId", "_id name avatar");
  if (msg.replyTo) {
    await msg.populate({
      path: "replyTo",
      select: "_id text senderId attachments createdAt",
      populate: { path: "senderId", select: "_id name avatar" },
    });
  }

  convo.lastMessageAt = new Date();

  // Người gửi rõ ràng đã đọc đến đây
  upsertLastRead(convo, new mongoose.Types.ObjectId(myId), new Date());
  await convo.save();

  // Nếu ai đó đã 'delete chat' trước đó, có message mới thì hiện lại
  try {
    await Conversation.updateOne(
      { _id: conversationId },
      { $pull: { hiddenFor: { $in: convo.members } } },
    );
  } catch (e) {}

  res.status(201).json({
    message: {
      id: msg._id,
      text: msg.text,
      attachments: (msg.attachments || []).map(toClientAttachment),
      senderId: {
        id: msg.senderId?._id || myId,
        name: msg.senderId?.name || req.user.name,
        avatarUrl: msg.senderId?.avatar?.url || null,
      },
      sender: msg.senderId
        ? {
            id: msg.senderId._id,
            name: msg.senderId.name,
            avatarUrl: msg.senderId.avatar?.url || null,
          }
        : null,
      createdAt: msg.createdAt,
      replyTo: msg.replyTo
        ? {
            id: msg.replyTo._id,
            text: msg.replyTo.text,
            attachments: (msg.replyTo.attachments || []).map(
              toClientAttachment,
            ),
            sender: msg.replyTo.senderId
              ? {
                  id: msg.replyTo.senderId._id,
                  name: msg.replyTo.senderId.name,
                  avatarUrl: msg.replyTo.senderId.avatar?.url || null,
                }
              : null,
            createdAt: msg.replyTo.createdAt,
          }
        : null,
      reactions: (msg.reactions || []).map((r) => ({
        userId: String(r.userId),
        emoji: r.emoji,
      })),
    },
  });
}

export async function editMessage(req, res) {
  const myId = req.user.id;
  const mid = req.params.id;
  const trimmed = String(req.body?.text || "").trim();

  if (!mongoose.Types.ObjectId.isValid(mid)) {
    return res.status(400).json({ message: "messageId không hợp lệ" });
  }
  if (!trimmed) return res.status(400).json({ message: "text is required" });

  const msg = await Message.findById(mid);
  if (!msg) return res.status(404).json({ message: "Message không tồn tại" });

  const convo = await Conversation.findOne({
    _id: msg.conversationId,
    members: myId,
  }).select("_id");
  if (!convo) return res.status(403).json({ message: "Không có quyền" });

  if (String(msg.senderId) !== String(myId)) {
    return res.status(403).json({ message: "Không phải tin của bạn" });
  }
  if (msg.isRecalled) {
    return res.status(400).json({ message: "Message đã thu hồi" });
  }

  msg.text = trimmed;
  msg.editedAt = new Date();
  await msg.save();

  return res.json({
    ok: true,
    message: { id: msg._id, text: msg.text, editedAt: msg.editedAt },
  });
}

export async function recallMessage(req, res) {
  const myId = req.user.id;
  const mid = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(mid)) {
    return res.status(400).json({ message: "messageId không hợp lệ" });
  }

  const msg = await Message.findById(mid);
  if (!msg) return res.status(404).json({ message: "Message không tồn tại" });

  const convo = await Conversation.findOne({
    _id: msg.conversationId,
    members: myId,
  }).select("_id");
  if (!convo) return res.status(403).json({ message: "Không có quyền" });

  if (String(msg.senderId) !== String(myId)) {
    return res.status(403).json({ message: "Không phải tin của bạn" });
  }

  msg.text = "Đã thu hồi tin nhắn";
  msg.attachments = [];
  msg.reactions = [];
  msg.isRecalled = true;
  msg.recalledAt = new Date();
  msg.recalledBy = new mongoose.Types.ObjectId(myId);
  await msg.save();

  return res.json({
    ok: true,
    message: {
      id: msg._id,
      text: msg.text,
      attachments: [],
      reactions: [],
      isRecalled: true,
      recalledAt: msg.recalledAt,
    },
  });
}

export async function togglePinMessage(req, res) {
  const myId = req.user.id;
  const mid = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(mid)) {
    return res.status(400).json({ message: "messageId không hợp lệ" });
  }

  const msg = await Message.findById(mid);
  if (!msg) return res.status(404).json({ message: "Message không tồn tại" });

  const convo = await Conversation.findOne({
    _id: msg.conversationId,
    members: myId,
  }).select("_id");
  if (!convo) return res.status(403).json({ message: "Không có quyền" });

  const nextPinned = !msg.pinned;
  msg.pinned = nextPinned;
  msg.pinnedAt = nextPinned ? new Date() : null;
  msg.pinnedBy = nextPinned ? new mongoose.Types.ObjectId(myId) : null;
  await msg.save();

  return res.json({
    ok: true,
    message: {
      id: msg._id,
      pinned: msg.pinned,
      pinnedAt: msg.pinnedAt,
      pinnedBy: msg.pinnedBy ? String(msg.pinnedBy) : null,
    },
  });
}
