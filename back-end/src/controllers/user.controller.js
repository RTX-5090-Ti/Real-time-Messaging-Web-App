import User from "../models/User.js";
import FriendRequest from "../models/FriendRequest.js";
import { cloudinary } from "../config/cloudinary.js";
import { getIO } from "../sockets/io.js";

const toSafeUser = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  gender: u.gender || null,
  dob: u.dob || null,
  avatarUrl: u.avatar?.url || null,
});

const isValidDob = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));

const uploadBufferToCloudinary = (fileBuffer, { folder } = {}) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "image",
        folder: folder || "chat_uploads/avatars",
        use_filename: true,
        unique_filename: true,
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );
    stream.end(fileBuffer);
  });

// Trả danh sách  User khác mình
export async function listUsers(req, res) {
  const users = await User.find({ _id: { $ne: req.user.id } })
    .select("_id name email role avatar")
    .sort({ createdAt: -1 });

  res.json({
    users: users.map((u) => ({
      id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      avatarUrl: u.avatar?.url || null,
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
    User.findOne({ email }).select("_id name email role avatar"),
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
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatar?.url || null,
    },
    relationship,
    outgoingRequestId,
    incomingRequestId,
  });
}

// GET /users/me
export async function getMe(req, res) {
  const u = await User.findById(req.user.id).select(
    "_id name email role gender dob avatar"
  );
  if (!u) return res.status(404).json({ message: "User không tồn tại" });
  return res.json({ user: toSafeUser(u) });
}

// PATCH /users/me
export async function updateMe(req, res) {
  const { name, gender, dob } = req.body || {};

  const $set = {};
  const $unset = {};

  if (name !== undefined) {
    const n = String(name || "").trim();
    if (!n)
      return res.status(400).json({ message: "Tên hiển thị không hợp lệ" });
    $set.name = n;
  }

  if (gender === "" || gender === null || gender === undefined) {
    $unset.gender = 1;
  } else if (gender === "male" || gender === "female") {
    $set.gender = gender;
  } else {
    return res.status(400).json({ message: "Giới tính không hợp lệ" });
  }

  if (dob === "" || dob === null || dob === undefined) {
    $unset.dob = 1;
  } else if (isValidDob(dob)) {
    $set.dob = String(dob);
  } else {
    return res.status(400).json({ message: "Ngày sinh không hợp lệ" });
  }

  const updateDoc = {};
  if (Object.keys($set).length) updateDoc.$set = $set;
  if (Object.keys($unset).length) updateDoc.$unset = $unset;

  const u = await User.findByIdAndUpdate(req.user.id, updateDoc, {
    new: true,
  }).select("_id name email role gender dob avatar");

  return res.json({ user: toSafeUser(u) });
}

// PATCH /users/me/avatar  (multer memory: req.file)
export async function updateMyAvatar(req, res) {
  const file = req.file;
  if (!file) return res.status(400).json({ message: "Thiếu file" });
  if (!String(file.mimetype || "").startsWith("image/")) {
    return res.status(400).json({ message: "Chỉ nhận file ảnh" });
  }

  const u = await User.findById(req.user.id).select(
    "_id name email role gender dob avatar"
  );
  if (!u) return res.status(404).json({ message: "User không tồn tại" });

  // upload new
  const result = await uploadBufferToCloudinary(file.buffer, {
    folder: "chat_uploads/avatars",
  });

  // delete old (best effort)
  if (u.avatar?.publicId) {
    try {
      await cloudinary.uploader.destroy(u.avatar.publicId, {
        resource_type: u.avatar.resourceType || "image",
      });
    } catch {
      // ignore
    }
  }

  u.avatar = {
    url: result.secure_url,
    publicId: result.public_id,
    resourceType: result.resource_type || "image",
  };
  await u.save();

  //  notify all connected clients so UI can update avatars everywhere
  try {
    const io = getIO();
    if (io) {
      try {
        const sockets = await io.in(`user:${String(u._id)}`).fetchSockets();
        for (const s of sockets) {
          if (s?.user) s.user.avatarUrl = u.avatar?.url || null;
        }
      } catch {}

      io.emit("user:avatar", {
        userId: String(u._id),
        avatarUrl: u.avatar?.url || null,
      });
    }
  } catch {
    // ignore
  }

  return res.json({ user: toSafeUser(u), avatarUrl: u.avatar.url });
}

// GET /users/:id (view other user's profile)
export async function getUserById(req, res) {
  const { id } = req.params;

  if (!id || !/^[0-9a-fA-F]{24}$/.test(String(id))) {
    return res.status(400).json({ message: "userId không hợp lệ" });
  }

  const u = await User.findById(id).select(
    "_id name email role gender dob avatar"
  );
  if (!u) return res.status(404).json({ message: "User không tồn tại" });

  return res.json({ user: toSafeUser(u) });
}
