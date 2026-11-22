import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { objectId, fail } from "../validations/chatPayload.js";
import { populateMessage, serializeMessage, sendChatMessage, mutateChatMessage } from "../services/message.service.js";

export async function getMessages(req, res) {
  const { conversationId, before, beforeId } = req.query;
  objectId(conversationId, "conversationId");
  const convo = await Conversation.findOne({ _id: conversationId, members: req.user.id });
  if (!convo) fail("FORBIDDEN", 403);
  const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
  const query = { conversationId };
  const participant = convo.participants.find(p => String(p.userId) === String(req.user.id));
  if (participant?.clearedAt) query.createdAt = { $gt: participant.clearedAt };
  if (before) {
    const at = new Date(before);
    if (Number.isNaN(at.getTime())) fail("INVALID_CURSOR");
    if (beforeId) {
      objectId(beforeId, "beforeId");
      query.$or = [{ createdAt: { $lt: at } }, { createdAt: at, _id: { $lt: beforeId } }];
    } else query.createdAt = { ...query.createdAt, $lt: at };
  } else if (beforeId) fail("INVALID_CURSOR");
  const docs = await populateMessage(Message.find(query).sort({ createdAt: -1, _id: -1 }).limit(limit + 1));
  const hasMore = docs.length > limit;
  const page = docs.slice(0, limit).reverse();
  res.json({ messages: page.map(serializeMessage), hasMore,
    nextBefore: page[0]?.createdAt || null, nextBeforeId: page[0]?._id || null });
}

export async function sendMessage(req, res) {
  const message = await sendChatMessage(req.user.id, req.body);
  res.status(201).json({ message });
}
const mutate = (action) => async (req, res) => {
  const message = await mutateChatMessage(req.user.id, action, { ...req.body, messageId: req.params.id });
  res.json({ ok: true, message });
};
export const editMessage = mutate("edit");
export const recallMessage = mutate("recall");
export const togglePinMessage = mutate("pin");
