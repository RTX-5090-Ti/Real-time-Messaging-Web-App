import mongoose from "mongoose";

import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";

function ensureParticipant(convo, userId, lastReadAt = null) {
  const uid = userId.toString();
  const exists = (convo.participants || []).some(
    (p) => p.userId?.toString() === uid
  );
  if (!exists) {
    convo.participants = convo.participants || [];
    convo.participants.push({ userId, lastReadAt, clearedAt: null });
  }
}

function getMyParticipant(convo, myId) {
  return (convo.participants || []).find(
    (p) => p.userId?.toString() === myId.toString()
  );
}

// Nếu đã có conversation direct giữa A-B -> trả lại conversation đó
// Nếu chưa có thì tạo mới
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
    convo = await Conversation.create({
      type: "direct",
      directKey,
      members: [myId, otherUserId],
      participants: [
        { userId: myId, lastReadAt: now },
        { userId: otherUserId, lastReadAt: now },
      ],
    });
  }

  // nếu trước đó user đã "delete chat" thì tạo/get direct sẽ hiện lại
  try {
    await Conversation.updateOne(
      { _id: convo._id },
      {
        $pull: {
          hiddenFor: {
            $in: [
              new mongoose.Types.ObjectId(myId),
              new mongoose.Types.ObjectId(otherUserId),
            ],
          },
        },
      }
    );
  } catch (e) {}

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

// Lấy các conversation mình là member (săp sếp cái mới nhất trước)
export async function listMyConversations(req, res) {
  const myId = req.user.id;

  const convos = await Conversation.find({
    members: myId,
    hiddenFor: { $ne: myId },
  })
    .sort({ updatedAt: -1 })
    .populate("members", "_id name email role avatar"); // lấy infor user cho members

  const myObjectId = new mongoose.Types.ObjectId(myId);

  // Lấy tin nhắn cuối cùng và số lượng tin nhắn cho các cuộc hội thoại
  const data = await Promise.all(
    convos.map(async (c) => {
      // Đảm bảo người tham gia có mặt(không đánh dấu đã đọc ở đây)
      ensureParticipant(c, myObjectId, null);

      const myP = getMyParticipant(c, myObjectId);
      const clearedAt = myP?.clearedAt ?? null;

      // Last message should respect clearedAt (Messenger-style "delete chat")
      const lastMsgQuery = { conversationId: c._id };
      if (clearedAt) lastMsgQuery.createdAt = { $gt: clearedAt };

      const lastMsg = await Message.findOne(lastMsgQuery)
        .sort({ createdAt: -1 })
        .populate("senderId", "_id name avatar");

      const lastReadAt = myP?.lastReadAt ?? null;
      // unread should count only after the later of (lastReadAt, clearedAt)
      const unreadAfter =
        lastReadAt && clearedAt
          ? new Date(
              Math.max(
                new Date(lastReadAt).getTime(),
                new Date(clearedAt).getTime()
              )
            )
          : lastReadAt || clearedAt || null;

      const unreadQuery = {
        conversationId: c._id,
        senderId: { $ne: myObjectId },
      };
      if (unreadAfter) unreadQuery.createdAt = { $gt: unreadAfter };

      const unread = await Message.countDocuments(unreadQuery);

      return {
        id: c._id,
        type: c.type,
        lastMessageAt: c.lastMessageAt,
        lastMessage: lastMsg
          ? {
              id: lastMsg._id,
              text: lastMsg.text,
              sender: lastMsg.senderId
                ? {
                    id: lastMsg.senderId._id,
                    name: lastMsg.senderId.name,
                    avatarUrl: lastMsg.senderId.avatar?.url || null,
                  }
                : null,
              createdAt: lastMsg.createdAt,
            }
          : null,
        unread,
        members: c.members.map((m) => ({
          id: m._id,
          name: m.name,
          email: m.email,
          role: m.role,
          avatarUrl: m.avatar?.url || null,
        })),
        updatedAt: c.updatedAt,
      };
    })
  );

  res.json({ conversations: data });
}
// Đã update

// Delete chat (ẩn conversation với riêng mình)
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
    { arrayFilters: [{ "p.userId": myObjectId }] }
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
        }
      );
    } catch (e) {}
  }

  return res.json({ ok: true });
}
