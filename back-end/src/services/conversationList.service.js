import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import User from "../models/User.js";

export async function listConversationSummaries(userId) {
  const uid = new mongoose.Types.ObjectId(userId);
  const epoch = new Date(0);
  // Two DB round trips regardless of conversation count. Each correlated message
  // lookup starts with conversationId and uses the message history indexes.
  const rows = await Conversation.aggregate([
    { $match: { members: uid, hiddenFor: { $ne: uid } } },
    { $set: { myParticipant: { $arrayElemAt: [{ $filter: { input: "$participants", as: "p", cond: { $eq: ["$$p.userId", uid] } } }, 0] },
      activityAt: { $ifNull: ["$lastMessageAt", "$createdAt"] } } },
    { $sort: { activityAt: -1, _id: -1 } },
    { $lookup: { from: "messages", let: { cid: "$_id", cleared: { $ifNull: ["$myParticipant.clearedAt", epoch] } }, pipeline: [
      { $match: { $expr: { $and: [{ $eq: ["$conversationId", "$$cid"] }, { $gt: ["$createdAt", "$$cleared"] }] } } },
      { $sort: { createdAt: -1, _id: -1 } }, { $limit: 1 },
      { $project: { text: 1, senderId: 1, createdAt: 1, attachments: 1, kind: 1 } },
    ], as: "lastMessages" } },
    { $lookup: { from: "messages", let: { cid: "$_id", after: { $max: [
      { $ifNull: ["$myParticipant.lastReadAt", epoch] }, { $ifNull: ["$myParticipant.clearedAt", epoch] },
    ] } }, pipeline: [
      { $match: { kind: "user", senderId: { $ne: uid }, $expr: { $and: [
        { $eq: ["$conversationId", "$$cid"] }, { $gt: ["$createdAt", "$$after"] },
      ] } } }, { $count: "count" },
    ], as: "unreadCounts" } },
    { $set: { lastMessage: { $arrayElemAt: ["$lastMessages", 0] }, unread: { $add: [
      { $ifNull: [{ $arrayElemAt: ["$unreadCounts.count", 0] }, 0] }, { $ifNull: ["$myParticipant.unreadExtra", 0] },
    ] } } },
    { $unset: ["lastMessages", "unreadCounts", "myParticipant"] },
  ]);
  const ids = [...new Set(rows.flatMap(c => [...c.members.map(String), c.lastMessage?.senderId && String(c.lastMessage.senderId)]).filter(Boolean))];
  const users = await User.find({ _id: { $in: ids } }).select("name email role avatar").lean();
  const byId = new Map(users.map(u => [String(u._id), { id: String(u._id), name: u.name, email: u.email, role: u.role, avatarUrl: u.avatar?.url || null }]));
  return rows.map(c => ({ id: String(c._id), type: c.type, name: c.name, avatarUrl: c.avatar?.url || null,
    members: c.members.map(m => byId.get(String(m))).filter(Boolean), adminIds: c.admins.map(String),
    createdBy: c.createdBy ? String(c.createdBy) : null, createdAt: c.createdAt, updatedAt: c.updatedAt,
    lastMessageAt: c.lastMessageAt, unread: c.unread,
    lastMessage: c.lastMessage ? { ...c.lastMessage, id: String(c.lastMessage._id), sender: byId.get(String(c.lastMessage.senderId)) || null } : null,
  }));
}
