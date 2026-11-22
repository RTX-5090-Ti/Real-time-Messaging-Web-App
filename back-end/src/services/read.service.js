import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { fail, objectId } from "../validations/chatPayload.js";

export async function markConversationRead(userId, { conversationId, messageId } = {}) {
  objectId(conversationId, "conversationId");
  objectId(messageId, "messageId");
  const uid = new mongoose.Types.ObjectId(userId);
  const message = await Message.findOne({ _id: messageId, conversationId }).select("createdAt");
  if (!message) fail("NO_MSG", 404);
  // Pipeline runs against the current document. No lost updates between tabs/read/send.
  const convo = await Conversation.findOneAndUpdate({ _id: conversationId, members: uid }, [{ $set: {
    participants: { $let: { vars: { ps: { $ifNull: ["$participants", []] } }, in: {
      $cond: [{ $in: [uid, "$$ps.userId"] },
        { $map: { input: "$$ps", as: "p", in: { $cond: [{ $eq: ["$$p.userId", uid] },
          { $mergeObjects: ["$$p", { lastReadAt: { $max: ["$$p.lastReadAt", message.createdAt] }, unreadExtra: 0 }] }, "$$p"] } } },
        { $concatArrays: ["$$ps", [{ userId: uid, lastReadAt: message.createdAt, clearedAt: null, unreadExtra: 0 }]] }],
    } } },
  } }], { new: true, updatePipeline: true });
  if (!convo) fail("FORBIDDEN", 403);
  const participant = convo.participants.find(p => String(p.userId) === String(userId));
  return { convo, at: participant.lastReadAt };
}
