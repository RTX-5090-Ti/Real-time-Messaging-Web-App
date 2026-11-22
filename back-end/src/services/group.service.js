import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import User from "../models/User.js";
import Message from "../models/Message.js";
import Notification from "../models/Notification.js";
import { fail, objectId } from "../validations/chatPayload.js";
import { getIO } from "../sockets/io.js";
import { evictConversationMember } from "../sockets/rooms.js";
import { serializeMessage } from "./message.service.js";

const includes = (ids, id) => ids.some(x => String(x) === String(id));

export async function changeGroup(actor, id, action, input = {}) {
  objectId(id, "conversationId");
  const targetId = action === "leave" ? actor.id : input.userId;
  if (action !== "profile") objectId(targetId, "userId");
  const result = await mongoose.connection.transaction(async session => {
    const convo = await Conversation.findOne({ _id: id, type: "group", members: actor.id }).session(session);
    if (!convo) fail("FORBIDDEN", 403);
    const owner = String(convo.createdBy) === String(actor.id);
    const admin = includes(convo.admins, actor.id);
    const targetMember = includes(convo.members, targetId);
    const targetAdmin = includes(convo.admins, targetId);
    const targetOwner = String(convo.createdBy) === String(targetId);
    if (["promote", "demote"].includes(action) && !owner) fail("OWNER_REQUIRED", 403);
    if (["kick", "profile"].includes(action) && !owner && !admin) fail("ADMIN_REQUIRED", 403);
    if (action === "kick" && (targetOwner || String(targetId) === String(actor.id) || (!owner && targetAdmin))) fail("CANNOT_KICK", 403);
    if (action === "demote" && targetOwner) fail("CANNOT_DEMOTE_OWNER", 403);
    if ((action === "add" && targetMember) || (["kick", "demote"].includes(action) && !targetMember) ||
      (action === "promote" && targetAdmin) || (action === "demote" && !targetAdmin)) return { already: true };
    if (action === "promote" && !targetMember) fail("NOT_MEMBER");

    let target;
    if (action !== "profile") target = await User.findById(targetId).select("name").session(session);
    if (action === "add" && !target) fail("NO_USER", 404);
    let removed = null;
    if (action === "add") {
      convo.members.push(targetId);
      convo.hiddenFor = convo.hiddenFor.filter(x => String(x) !== targetId);
      convo.participants = convo.participants.filter(p => String(p.userId) !== targetId);
      convo.participants.push({ userId: targetId, lastReadAt: new Date(), clearedAt: null, unreadExtra: 1 });
    } else if (["leave", "kick"].includes(action)) {
      removed = targetId;
      convo.members = convo.members.filter(x => String(x) !== targetId);
      convo.admins = convo.admins.filter(x => String(x) !== targetId);
      convo.participants = convo.participants.filter(p => String(p.userId) !== targetId);
      convo.hiddenFor = convo.hiddenFor.filter(x => String(x) !== targetId);
      if (targetOwner) convo.createdBy = convo.members[0] || null;
      if (convo.createdBy && !includes(convo.admins, convo.createdBy)) convo.admins.push(convo.createdBy);
      if (!convo.admins.length && convo.members.length) convo.admins.push(convo.members[0]);
    } else if (action === "promote") convo.admins.push(targetId);
    else if (action === "demote") convo.admins = convo.admins.filter(x => String(x) !== targetId);
    else if (action === "profile") {
      if (input.name !== undefined) {
        if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 60) fail("INVALID_NAME");
        convo.name = input.name.trim();
      }
      if (input.avatar !== undefined) {
        if (!input.avatar) convo.avatar = { url: null, publicId: null, resourceType: "image" };
        else {
          const url = input.avatar.url || input.avatar.avatarUrl;
          if (typeof url !== "string" || !url.startsWith("https://")) fail("INVALID_AVATAR");
          convo.avatar = { url, publicId: input.avatar.publicId || null, resourceType: "image" };
        }
      }
    } else fail("INVALID_ACTION");

    let message = null;
    let notification = null;
    if (action !== "profile") {
      const types = { add: "member_added", leave: "member_left", kick: "member_removed", promote: "admin_promoted", demote: "admin_removed" };
      const verbs = { add: "added", leave: "left the group", kick: "removed", promote: "promoted", demote: "removed admin role from" };
      [message] = await Message.create([{ conversationId: id, kind: "system", senderId: null,
        text: `${actor.name} ${verbs[action]}${action === "leave" ? "" : ` ${target?.name || "a member"}`}`,
        system: { type: types[action], actorId: actor.id, actorName: actor.name,
          targetId: action === "leave" ? null : targetId, targetName: target?.name || "" },
      }], { session });
      convo.lastMessageAt = new Date(Math.max(Number(convo.lastMessageAt || 0), Number(message.createdAt)));
    }
    if (action === "kick") {
      [notification] = await Notification.create([{ userId: targetId, type: "kicked_from_group",
        data: { conversationId: id, conversationName: convo.name || "", by: { id: actor.id, name: actor.name, avatarUrl: actor.avatarUrl || null } },
      }], { session });
    }
    await convo.save({ session });
    return { convo, message, removed, notification };
  });
  if (result.already) return { ok: true, already: true };
  const { convo, message, removed, notification } = result;
  const io = getIO();
  if (removed) await evictConversationMember(id, removed);
  for (const member of convo.members) {
    if (message) io?.to(`user:${member}`).emit("message:new", serializeMessage(message));
    io?.to(`user:${member}`).emit("conversation:updated", { conversationId: id });
  }
  if (action === "add") io?.to(`user:${targetId}`).emit("conversation:new", { conversationId: id });
  if (removed) io?.to(`user:${removed}`).emit("conversation:updated", { conversationId: id });
  if (notification) {
    io?.to(`user:${removed}`).emit("conversation:kicked", { conversationId: id, by: { id: actor.id, name: actor.name } });
    io?.to(`user:${removed}`).emit("notification:new", { ...notification.toObject(), id: String(notification._id) });
  }
  return { ok: true, conversation: { id, name: convo.name, avatarUrl: convo.avatar?.url || null } };
}
