import { authenticateAccess } from "../services/session.service.js";
import User from "../models/User.js";

// Bảo vệ route (chỉ user hợp lệ mới vào được API)
export async function requireAuth(req, res, next) {
  try {
    // Lấy token từ cookie
    const cookieName = process.env.COOKIE_NAME || "access_token";
    const token = req.cookies?.[cookieName];

    const decoded = await authenticateAccess(token);
    req.auth = decoded;
    const user = await User.findById(decoded.sub).select(
      "_id name email role gender dob avatar"
    );
    if (!user) return res.status(401).send({ message: "User  không tồn tại" });

    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,

      //  profile
      gender: user.gender || null,
      dob: user.dob || null,
      avatarUrl: user.avatar?.url || null,
    };
    next();
  } catch (error) {
    if (error.status !== 401) return next(error);
    return res.status(401).json({ message: error.code, code: error.code });
  }
}
