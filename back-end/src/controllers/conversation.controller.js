import mongoose from "mongoose";

import Conversation from "../models/Conversation.js";
import User from "../models/User.js";
import { getIO } from "../sockets/io.js";
import { changeGroup } from "../services/group.service.js";
import { listConversationSummaries } from "../services/conversationList.service.js";

export async function createOrGetDirect(req, res) {
  const myId = req.user.id;
  const { otherUserId } = req.body;

  if (otherUserId === myId)
    return res.status(400).json({ message: "không thể chat với chính mình" });

  const [a, b] = [String(myId), String(otherUserId)].sort();
  const directKey = `${a}_${b}`;
  // Tìm Conversation direct có đủ  2 người
  let convo = await Conversation.findOne({
    type: "direct",
    directKey,
  });

  const now = new Date();

  if (!convo) {
    convo = await Conversation.findOne({
      type: "direct",
      members: { $all: [myId, otherUserId] },
      $expr: { $eq: [{ $size: "$members" }, 2] },
    });

    // nếu tìm được convo cũ thì gắn directKey luôn cho lần sau
    if (convo && !convo.directKey) {
      convo.directKey = directKey;
      await convo.save();
    }
  }

  if (!convo) {
    try {
    convo = await Conversation.create({
      type: "direct",
      directKey,
      members: [myId, otherUserId],
      participants: [
        { userId: myId, lastReadAt: now },
        { userId: otherUserId, lastReadAt: now },
      ],
    });
    } catch (err) {
      if (err.code !== 11000) throw err;
      convo = await Conversation.findOne({ type: "direct", directKey });
      if (!convo) throw err;
    }
  }

  // nếu trước đó user đã "delete chat" thì tạo/get direct sẽ hiện lại
  // Restore only the caller. The hiddenFor condition makes retries idempotent.
  const uid = new mongoose.Types.ObjectId(myId);
  const restored = await Conversation.updateOne(
    { _id: convo._id, hiddenFor: uid },
    [{ $set: {
      hiddenFor: { $filter: { input: "$hiddenFor", as: "id", cond: { $ne: ["$$id", uid] } } },
      participants: { $cond: [
        { $in: [uid, { $ifNull: ["$participants.userId", []] }] },
        { $map: { input: "$participants", as: "p", in: { $cond: [
          { $eq: ["$$p.userId", uid] },
          { $mergeObjects: ["$$p", { reopenedAt: now }] }, "$$p",
        ] } } },
        { $concatArrays: [{ $ifNull: ["$participants", []] }, [{ userId: uid, reopenedAt: now }]] },
      ] },
    } }],
    { updatePipeline: true },
  );
  if (restored.modifiedCount) {
    getIO()?.to(`user:${myId}`).emit("conversation:updated", { conversationId: String(convo._id) });
  }

  return res.status(201).json({
    conversation: {
      id: convo._id,
      type: convo.type,
      members: convo.members,
      lastMessageAt: convo.lastMessageAt,
      createdAt: convo.createdAt,
    },
  });
}

// Create a group conversation
// body: { name, memberIds: [userId,...] }
export async function createGroup(req, res) {
  const myId = req.user.id;
  const rawName = String(req.body?.name || "").trim();
  const memberIds = Array.isArray(req.body?.memberIds)
    ? req.body.memberIds
    : [];

  // Unique + remove myself (we will add me back)
  const others = [...new Set(memberIds.map(String))].filter(
    (id) => id && id !== String(myId),
  );

  // Group should have at least 3 people total (me + 2 others)
  if (others.length < 2) {
    return res.status(400).json({
      message: "Group chat cần tối thiểu 3 người (bạn + 2 người khác)",
    });
  }

  const allMemberIds = [String(myId), ...others];
  const objectIds = allMemberIds.map((id) => new mongoose.Types.ObjectId(id));

  // Optional: ensure users exist
  const existing = await User.find({ _id: { $in: objectIds } }).select("_id");
  if (existing.length !== objectIds.length) {
    return res.status(400).json({ message: "Có thành viên không tồn tại" });
  }

  const now = new Date();

  const convo = await Conversation.create({
    type: "group",
    name: rawName,
    members: objectIds,
    createdBy: new mongoose.Types.ObjectId(myId),
    admins: [new mongoose.Types.ObjectId(myId)],
    participants: objectIds.map((uid) => ({
      userId: uid,
      lastReadAt: now,
      clearedAt: null,
    })),
  });

  await convo.populate("members", "_id name email role avatar");

  //  notify all members: new conversation created
  const io = getIO();
  if (io) {
    for (const m of convo.members) {
      const mid = String(m?._id || m);
      io.to(`user:${mid}`).emit("conversation:new", {
        conversationId: String(convo._id),
      });
    }
  }

  return res.status(201).json({
    conversation: {
      id: convo._id,
      type: convo.type,
      name: convo.name,
      avatarUrl: convo.avatar?.url || null,
      members: convo.members.map((m) => ({
        id: m._id,
        name: m.name,
        email: m.email,
        role: m.role,
        avatarUrl: m.avatar?.url || null,
      })),
      createdBy: convo.createdBy ? String(convo.createdBy) : null,
      createdAt: convo.createdAt,
      lastMessageAt: convo.lastMessageAt,
    },
  });
}

// Lấy các conversation mình là member (săp sếp cái mới nhất trước)
export async function listMyConversations(req, res) {
  res.json({ conversations: await listConversationSummaries(req.user.id) });
}

export async function deleteConversationForMe(req, res) {
  const myId = req.user.id;
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "conversationId không hợp lệ" });
  }

  const convo = await Conversation.findOne({ _id: id, members: myId });
  if (!convo)
    return res.status(404).json({ message: "Conversation không tồn tại" });

  const now = new Date();

  // 1) hide from list for this user
  // 2) set clearedAt (Messenger vibe: old messages won't appear again for this user)
  // 3) also bump lastReadAt to now to avoid old messages counted as unread
  const myObjectId = new mongoose.Types.ObjectId(myId);

  const r = await Conversation.updateOne(
    { _id: id },
    {
      $addToSet: { hiddenFor: myObjectId },
      $set: {
        "participants.$[p].clearedAt": now,
        "participants.$[p].lastReadAt": now,
      },
    },
    { arrayFilters: [{ "p.userId": myObjectId }] },
  );

  // If participant entry didn't exist (edge case), create it
  if (r.matchedCount > 0 && r.modifiedCount === 0) {
    try {
      await Conversation.updateOne(
        { _id: id },
        {
          $addToSet: { hiddenFor: myObjectId },
          $push: {
            participants: {
              userId: myObjectId,
              lastReadAt: now,
              clearedAt: now,
            },
          },
        },
      );
    } catch (e) {}
  }

  return res.json({ ok: true });
}

const groupAction = action => async (req, res) => {
  const input = { ...req.body, ...(req.params.userId ? { userId: req.params.userId } : {}) };
  res.json(await changeGroup(req.user, req.params.id, action, input));
};
export const leaveGroup = groupAction("leave");
export const addGroupMember = groupAction("add");
export const kickGroupMember = groupAction("kick");
export const makeGroupAdmin = groupAction("promote");
export const removeGroupAdmin = groupAction("demote");
export const updateGroupProfile = groupAction("profile");
