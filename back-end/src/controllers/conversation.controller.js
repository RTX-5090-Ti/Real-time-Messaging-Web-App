import mongoose from "mongoose";

import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { getIO } from "../sockets/io.js";

function ensureParticipant(convo, userId, lastReadAt = null) {
  const uid = userId.toString();
  const exists = (convo.participants || []).some(
    (p) => p.userId?.toString() === uid,
  );
  if (!exists) {
    convo.participants = convo.participants || [];
    convo.participants.push({ userId, lastReadAt, clearedAt: null });
  }
}

function getMyParticipant(convo, myId) {
  return (convo.participants || []).find(
    (p) => p.userId?.toString() === myId.toString(),
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
      },
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
                new Date(clearedAt).getTime(),
              ),
            )
          : lastReadAt || clearedAt || null;

      const unreadQuery = {
        conversationId: c._id,
        senderId: { $ne: myObjectId },
      };
      if (unreadAfter) {
        unreadQuery.createdAt = { $gt: unreadAfter };
        unreadQuery.kind = "user";
      }

      const unread = await Message.countDocuments(unreadQuery);

      return {
        id: c._id,
        type: c.type,
        lastMessageAt: c.lastMessageAt,
        name: c.name || null,
        avatarUrl: c.avatar?.url || null,
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
    }),
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

export async function leaveGroup(req, res) {
  const myId = req.user.id;
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "conversationId không hợp lệ" });
  }

  const convo = await Conversation.findOne({ _id: id, members: myId });
  if (!convo) {
    return res.status(404).json({ message: "Conversation không tồn tại" });
  }

  if (String(convo.type) !== "group") {
    return res.status(400).json({ message: "Chỉ group chat mới leave được" });
  }

  const myObjectId = new mongoose.Types.ObjectId(myId);

  // ✅ members còn lại (PHẢI lấy trước khi pull)
  const remainMemberIds = (convo.members || []).filter(
    (m) => String(m) !== String(myId),
  );

  // remove khỏi members + participants + admins
  await Conversation.updateOne(
    { _id: id },
    {
      $pull: {
        members: myObjectId,
        admins: myObjectId,
        hiddenFor: myObjectId,
        participants: { userId: myObjectId },
      },
    },
  );

  // ✅ system message "A đã rời nhóm"
  const systemMsg = await Message.create({
    conversationId: id,
    kind: "system",
    text: `${req.user.name} has left the group`,
    system: {
      action: "leave_group",
      actorId: myObjectId,
      actorName: req.user.name,
    },
  });

  await Conversation.updateOne(
    { _id: id },
    { $set: { lastMessageAt: systemMsg.createdAt } },
  );

  const io = getIO();

  // ✅ emit message:new cho những người còn lại
  if (io && remainMemberIds.length) {
    for (const mid of remainMemberIds) {
      io.to(`user:${String(mid)}`).emit("message:new", {
        kind: "system",
        conversationId: String(id),
        id: String(systemMsg._id),
        text: systemMsg.text,
        system: systemMsg.system,
        attachments: [],
        sender: null,
        createdAt: systemMsg.createdAt,
      });

      io.to(`user:${String(mid)}`).emit("conversation:updated", {
        conversationId: String(id),
      });
    }

    // user vừa leave cũng reload list để biến mất convo
    io.to(`user:${String(myId)}`).emit("conversation:updated", {
      conversationId: String(id),
    });
  }

  // reload convo để check admin còn không
  const updated = await Conversation.findById(id).select("members admins");
  if (!updated) return res.json({ ok: true });

  // nếu hết admin thì chọn member đầu làm admin
  if ((updated.admins || []).length === 0 && (updated.members || []).length) {
    updated.admins = [updated.members[0]];
    await updated.save();
  }

  return res.json({ ok: true });
}

export async function addGroupMember(req, res) {
  try {
    const myId = req.user.id;
    const { id } = req.params;
    const { userId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "conversationId không hợp lệ" });
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "userId không hợp lệ" });
    }

    const convo = await Conversation.findById(id);
    if (!convo)
      return res.status(404).json({ message: "Conversation không tồn tại" });

    if (String(convo.type) !== "group") {
      return res
        .status(400)
        .json({ message: "Chỉ group chat mới add member được" });
    }

    // ✅ chỉ member mới được add người khác
    if (!(convo.members || []).some((m) => String(m) === String(myId))) {
      return res.status(403).json({ message: "Bạn không ở trong group này" });
    }

    // ✅ nếu đã là member rồi thì thôi
    if ((convo.members || []).some((m) => String(m) === String(userId))) {
      return res.json({ ok: true, already: true });
    }

    const userToAdd = await User.findById(userId).select("name");
    if (!userToAdd)
      return res.status(404).json({ message: "User không tồn tại" });

    const userObjId = new mongoose.Types.ObjectId(userId);

    // ✅ FIX CONFLICT: tách participants ra 2 update (pull trước, push sau)
    await Conversation.updateOne(
      { _id: id },
      {
        $addToSet: { members: userObjId },
        $pull: {
          hiddenFor: userObjId,
          participants: { userId: userObjId },
        },
      },
    );

    await Conversation.updateOne(
      { _id: id },
      {
        $push: {
          participants: {
            userId: userObjId,
            lastReadAt: new Date(0),
            clearedAt: null,
          },
        },
      },
    );

    // ✅ system message (A thêm B / A thêm bạn)
    const sys = {
      type: "member_added",
      actorId: String(myId),
      actorName: req.user.name,
      targetId: String(userId),
      targetName: userToAdd.name,
    };

    const systemMsg = await Message.create({
      conversationId: id,
      kind: "system",
      senderId: null,
      system: sys,
      text: `${req.user.name} added ${userToAdd.name} to the group.`,
    });

    await Conversation.updateOne(
      { _id: id },
      { $set: { lastMessageAt: systemMsg.createdAt } },
    );

    const updated = await Conversation.findById(id).select("members");
    const memberIds = (updated?.members || []).map((x) => String(x));

    const io = getIO();
    if (io) {
      for (const mid of memberIds) {
        io.to(`user:${mid}`).emit("message:new", {
          kind: "system",
          conversationId: String(id),
          id: String(systemMsg._id),
          text: systemMsg.text,
          system: systemMsg.system, // ✅ IMPORTANT để UI hiện “thêm bạn”
          attachments: [],
          sender: null,
          createdAt: systemMsg.createdAt,
        });

        io.to(`user:${mid}`).emit("conversation:updated", {
          conversationId: String(id),
        });
      }

      // ✅ thằng mới vào group chắc chắn thấy group xuất hiện ngay
      io.to(`user:${String(userId)}`).emit("conversation:new", {
        conversationId: String(id),
      });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.log("addGroupMember error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
}
