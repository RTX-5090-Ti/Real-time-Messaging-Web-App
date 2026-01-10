import User from "../models/User.js";
import FriendRequest from "../models/FriendRequest.js";

// Trả danh sách  User khác mình
export async function listUsers(req, res) {
  const users = await User.find({ _id: { $ne: req.user.id } })
    .select("_id name email role")
    .sort({ createdAt: -1 });

  res.json({
    users: users.map((u) => ({
      id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
    })),
  });
}

//  GET /users/search?email=...
export async function searchUserByEmail(req, res) {
  const meId = req.user.id;
  const email = (req.query.email || "").toString().trim().toLowerCase();
  if (!email) return res.status(400).json({ message: "Thiếu email" });

  const [me, user] = await Promise.all([
    User.findById(meId).select("_id friends"),
    User.findOne({ email }).select("_id name email role"),
  ]);

  if (!user) return res.status(404).json({ message: "Không tìm thấy user" });

  let relationship = "none";
  let outgoingRequestId = null;
  let incomingRequestId = null;

  if (String(user._id) === String(meId)) {
    relationship = "self";
  } else if (
    (me?.friends || []).some((id) => String(id) === String(user._id))
  ) {
    relationship = "friends";
  } else {
    const [outReq, inReq] = await Promise.all([
      FriendRequest.findOne({
        fromUserId: meId,
        toUserId: user._id,
        status: "pending",
      }).select("_id"),
      FriendRequest.findOne({
        fromUserId: user._id,
        toUserId: meId,
        status: "pending",
      }).select("_id"),
    ]);

    if (outReq) {
      relationship = "outgoing_pending";
      outgoingRequestId = outReq._id;
    } else if (inReq) {
      relationship = "incoming_pending";
      incomingRequestId = inReq._id;
    }
  }

  return res.json({
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
    relationship,
    outgoingRequestId,
    incomingRequestId,
  });
}
