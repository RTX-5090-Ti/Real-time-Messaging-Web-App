import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import { getIO } from "../sockets/io.js";
import { fail, objectId, messageText, validateSend } from "../validations/chatPayload.js";
import { limitMessage } from "../middlewares/rateLimit.js";

const sender = (u) => u ? { id: String(u._id), name: u.name, avatarUrl: u.avatar?.url || null } : null;
export function serializeMessage(doc) {
  const m = doc.toObject ? doc.toObject() : doc;
  return { ...m, id: String(m._id), conversationId: String(m.conversationId),
    sender: sender(m.senderId), senderId: undefined,
    replyTo: m.replyTo ? { id: String(m.replyTo._id), text: m.replyTo.text,
      attachments: m.replyTo.attachments || [], sender: sender(m.replyTo.senderId), createdAt: m.replyTo.createdAt } : null,
    reactions: (m.reactions || []).map(r => ({ userId: String(r.userId), emoji: r.emoji })),
    pinnedBy: m.pinnedBy ? String(m.pinnedBy) : null,
    recalledBy: m.recalledBy ? String(m.recalledBy) : null };
}
export const populateMessage = (query) => query.populate("senderId", "_id name avatar").populate({
  path: "replyTo", select: "text attachments senderId createdAt",
  populate: { path: "senderId", select: "_id name avatar" },
});

function broadcast(convo, event, payload) {
  const io = getIO();
  for (const member of convo.members) io?.to(`user:${member}`).emit(event, payload);
}

export async function sendChatMessage(userId, input) {
  const data = validateSend(input);
  limitMessage(String(userId));
  const convo = await Conversation.findOne({ _id: data.conversationId, members: userId });
  if (!convo) fail("FORBIDDEN", 403);
  const key = { conversationId: data.conversationId, senderId: userId, clientId: data.clientId };
  let msg = await Message.findOne(key);
  let replay = !!msg;
  if (!msg) {
    if (data.replyTo && !await Message.exists({ _id: data.replyTo, conversationId: data.conversationId })) fail("INVALID_REPLY");
    try { msg = await Message.create({ ...data, senderId: userId }); }
    catch (err) {
      if (err.code !== 11000) throw err;
      replay = true;
      msg = await Message.findOne(key);
      if (!msg) throw err;
    }
  }
  // Safe to repeat after a lost ACK or a failure after Message.create().
  await Conversation.updateOne({ _id: convo._id }, {
    $max: { lastMessageAt: msg.createdAt },
    $pull: { hiddenFor: { $in: convo.members } },
  });
  const payload = serializeMessage(await populateMessage(Message.findById(msg._id)));
  broadcast(convo, "message:new", { ...payload, replay });
  return payload;
}

export async function mutateChatMessage(userId, action, input) {
  limitMessage(String(userId));
  for (let attempt = 0; attempt < 8; attempt++) {
    try { return await mutateOnce(userId, action, input); }
    catch (error) { if (error.name !== "VersionError") throw error; }
  }
  fail("CONCURRENT_UPDATE_RETRY", 409);
}

async function mutateOnce(userId, action, input) {
  objectId(input.messageId, "messageId");
  if (input.conversationId !== undefined) objectId(input.conversationId, "conversationId");
  const msg = await Message.findById(input.messageId);
  if (!msg) fail("NO_MSG", 404);
  if (input.conversationId && String(msg.conversationId) !== input.conversationId) fail("NO_MSG", 404);
  const convo = await Conversation.findOne({ _id: msg.conversationId, members: userId });
  if (!convo) fail("FORBIDDEN", 403);
  if (["edit", "recall"].includes(action) && String(msg.senderId) !== String(userId)) fail("NOT_OWNER", 403);
  let event;
  if (action === "edit") {
    if (msg.isRecalled) fail("RECALLED");
    msg.text = messageText(input.text, true);
    msg.editedAt = new Date();
    event = "message:edited";
  } else if (action === "recall") {
    msg.text = "Đã thu hồi tin nhắn";
    msg.attachments = [];
    msg.reactions = [];
    msg.isRecalled = true;
    msg.recalledAt = msg.recalledAt || new Date();
    msg.recalledBy = userId;
    event = "message:recalled";
  } else if (action === "pin") {
    msg.pinned = !msg.pinned;
    msg.pinnedAt = msg.pinned ? new Date() : null;
    msg.pinnedBy = msg.pinned ? userId : null;
    event = "message:pinned";
  } else if (action === "react") {
    if (!["❤️", "😆", "😮", "😭", "👍"].includes(input.emoji)) fail("INVALID_EMOJI");
    if (msg.isRecalled) fail("RECALLED");
    const old = msg.reactions.find(r => String(r.userId) === String(userId));
    msg.reactions = msg.reactions.filter(r => String(r.userId) !== String(userId));
    if (old?.emoji !== input.emoji) msg.reactions.push({ userId, emoji: input.emoji });
    event = "message:reaction";
  } else fail("INVALID_ACTION");
  await msg.save();
  const payload = serializeMessage(await populateMessage(Message.findById(msg._id)));
  broadcast(convo, event, { ...payload, messageId: payload.id });
  return payload;
}
