import Conversation from "../models/Conversation.js";
import { objectId, fail } from "../validations/chatPayload.js";
import { markConversationRead } from "../services/read.service.js";

export function registerConversationHandlers(io, socket, on, typing) {
  async function membership(cid) {
    objectId(cid, "conversationId");
    const convo = await Conversation.findOne({ _id: cid, members: socket.user.id }).select("participants").lean();
    if (!convo) fail("FORBIDDEN", 403);
    return convo;
  }
  on("conversation:join", async cid => {
    await membership(cid);
    await socket.join(cid);
    // Recheck after joining to close the race with removal from the group.
    let current;
    try { current = await membership(cid); }
    catch (error) { await socket.leave(cid); throw error; }
    for (const participant of current.participants || []) {
      if (participant.lastReadAt) socket.emit("conversation:read", {
        conversationId: cid, userId: String(participant.userId), at: participant.lastReadAt, snapshot: true,
      });
    }
    socket.emit("conversation:joined", { conversationId: cid });
  });
  on("conversation:leave", async cid => {
    objectId(cid, "conversationId");
    typing.stop(cid, socket);
    await socket.leave(cid);
  });
  on("conversation:read", async (payload, ack) => {
    const { convo, at } = await markConversationRead(socket.user.id, payload);
    const result = { conversationId: String(convo._id), userId: socket.user.id, at };
    for (const mid of convo.members) io.to(`user:${mid}`).emit("conversation:read", result);
    ack({ ok: true, ...result });
  });
  on("typing:start", async ({ conversationId }) => {
    await membership(conversationId);
    if (socket.connected === false) return;
    typing.start(conversationId, socket);
  });
  on("typing:stop", async ({ conversationId }) => {
    objectId(conversationId, "conversationId");
    typing.stop(conversationId, socket);
  });
}
