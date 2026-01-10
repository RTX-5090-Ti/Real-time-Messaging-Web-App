import mongoose from "mongoose";
import User from "../models/User.js";
import FriendRequest from "../models/FriendRequest.js";
import { getIO } from "../sockets/io.js";
import Notification from "../models/Notification.js";

// Trả về “user sạch”: chỉ các field cần cho FE (không lộ password, vv)
function safeUser(u) {
  return {
    id: u._id,
    name: u.name,
    email: u.email,
    role: u.role,
  };
}

// Gửi event socket tới room riêng của user: user:<id>
function emitToUser(userId, event, payload) {
  const io = getIO();
  if (!io) return;
  io.to(`user:${String(userId)}`).emit(event, payload);
}

// Get /friends - lấy danh sách bạn bè
export async function listFriends(req, res) {
  const meId = req.user.id;

  const me = await User.findById(meId)
    .populate("friends", "_id name email role")
    .select("friends");

  const friends = (me?.friends ?? []).map(safeUser);
  return res.json({ friends });
}

// Get /friends/requests/incoming?status=pending - lấy lời mời đến
export async function listIncomingRequests(req, res) {
  const meId = req.user.id;
  const status = (req.query.status || "pending").toString();

  const requests = await FriendRequest.find({
    toUserId: meId,
    status,
  })
    .populate("fromUserId", "_id name email role")
    .sort({ createdAt: -1 });

  return res.json({
    requests: requests.map((r) => ({
      id: r._id,
      status: r.status,
      createdAt: r.createdAt,
      from: r.fromUserId ? safeUser(r.fromUserId) : null,
    })),
  });
}

// Post /friends/requests { toUserId } - gửi lời mời kết bạn
export async function sendFriendRequest(req, res) {
  const meId = req.user.id;
  const { toUserId } = req.body;

  if (!toUserId || !mongoose.Types.ObjectId.isValid(toUserId)) {
    return res.status(400).json({ message: "toUserId không hợp lệ" });
  }
  if (String(toUserId) === String(meId)) {
    return res
      .status(400)
      .json({ message: "Không thể kết bạn với chính mình" });
  }

  const [me, toUser] = await Promise.all([
    User.findById(meId).select("_id name email role friends"),
    User.findById(toUserId).select("_id name email role friends"),
  ]);

  if (!toUser) return res.status(400).json({ message: "User không tồn tại" });

  // Đã là bạn rồi
  const isFriend = (me.friends || []).some(
    (id) => String(id) === String(toUserId)
  );
  if (isFriend) return res.status(409).json({ message: "Đã là bạn bè  rồi" });

  // Đã gửi pending
  const existingOutgoing = await FriendRequest.findOne({
    fromUserId: meId,
    toUserId,
    status: "pending",
  });
  if (existingOutgoing)
    return res.status(409).json({
      message: "Đã gửi lời mời rồi",
      requestId: existingOutgoing._id,
    });

  // Đang có  incoming (B đã gừi cho A)
  const existingIncoming = await FriendRequest.findOne({
    fromUserId: toUserId,
    toUserId: meId,
    status: "pending",
  });
  if (existingIncoming)
    return res.status(409).json({
      message: "Bạn đang có lời mời từ người này",
      incomingRequestId: existingIncoming._id,
      relationship: "incoming_pending",
    });

  const request = await FriendRequest.create({
    fromUserId: meId,
    toUserId,
    status: "pending",
  });

  // Notify người nhận
  emitToUser(toUserId, "notification:new", {
    type: "friend_request",
    requestId: request._id,
    from: { id: me._id, name: me.name, email: me.email },
    createdAt: request.createdAt,
  });

  return res.json({
    message: "Đã gửi lời mời kết bạn",
    request: {
      id: request._id,
      status: request.status,
      createdAt: request.createdAt,
      to: safeUser(toUser),
    },
  });
}

//  POST /friends/requests/:id/accept - chấp nhận lời mời
export async function acceptFriendRequest(req, res) {
  const meId = req.user.id;
  const { id } = req.params;

  const session = await mongoose.startSession();
  try {
    let request;

    await session.withTransaction(async () => {
      request = await FriendRequest.findById(id).session(session);
      if (!request) throw new Error("NOT_FOUND");
      if (String(request.toUserId) !== String(meId))
        throw new Error("FORBIDDEN");
      if (request.status !== "pending") throw new Error("NOT_PENDING");

      request.status = "accepted";
      await request.save({ session });

      await User.updateOne(
        { _id: meId },
        { $addToSet: { friends: request.fromUserId } },
        { session }
      );

      await User.updateOne(
        { _id: request.fromUserId },
        { $addToSet: { friends: meId } },
        { session }
      );
    });

    const [me, fromUser] = await Promise.all([
      User.findById(meId).select("_id name email role"),
      User.findById(request.fromUserId).select("_id name email role"),
    ]);

    emitToUser(request.fromUserId, "notification:new", {
      type: "friend_request_accepted",
      requestId: request._id,
      by: { id: me._id, name: me.name, email: me.email },
      createdAt: new Date().toISOString(),
    });

    emitToUser(request.fromUserId, "friend:updated", { friend: safeUser(me) });
    emitToUser(meId, "friend:updated", { friend: safeUser(fromUser) });

    return res.json({
      message: "Đã chấp nhận lời mời",
      friend: safeUser(fromUser),
    });
  } catch (e) {
    if (String(e.message) === "NOT_FOUND")
      return res.status(404).json({ message: "Request không tồn tại" });
    if (String(e.message) === "FORBIDDEN")
      return res.status(403).json({ message: "Không có quyền" });
    if (String(e.message) === "NOT_PENDING")
      return res.status(400).json({ message: "Request không còn pending" });

    return res.status(500).json({ message: "Server error" });
  } finally {
    session.endSession();
  }
}

//  POST /friends/requests/:id/reject - từ chối lời mời
export async function rejectFriendRequest(req, res) {
  const meId = req.user.id;
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "request id không hợp lệ" });
  }

  const request = await FriendRequest.findById(id);
  if (!request)
    return res.status(404).json({ message: "Request không tồn tại" });

  if (String(request.toUserId) !== String(meId)) {
    return res.status(403).json({ message: "Không có quyền" });
  }
  if (request.status !== "pending") {
    return res.status(409).json({ message: "Request không còn pending" });
  }

  request.status = "rejected";
  await request.save();

  const me = await User.findById(meId).select("_id name email");
  //  notify người gửi (và người reject cũng nhận để UI update)
  emitToUser(request.fromUserId, "notification:new", {
    type: "friend_request_rejected",
    requestId: request._id,
    by: { id: me._id, name: me.name, email: me.email },
    createdAt: new Date().toISOString(),
  });

  // emitToUser(meId, "notification:new", {
  //   type: "friend_request_rejected",
  //   requestId: request._id,
  //   by: { id: request.fromUserId },
  //   createdAt: new Date().toISOString(),
  // });

  return res.json({ message: "Đã từ chối lời mời" });
}
