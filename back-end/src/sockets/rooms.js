import { getIO } from "./io.js";

export async function evictConversationMember(conversationId, userId) {
  const io = getIO();
  if (!io) return;
  const cid = String(conversationId);
  io.typingTracker?.removeUser(cid, String(userId));
  await io.in(`user:${userId}`).socketsLeave(cid);
  io.to(`user:${userId}`).emit("conversation:removed", { conversationId: cid });
}
