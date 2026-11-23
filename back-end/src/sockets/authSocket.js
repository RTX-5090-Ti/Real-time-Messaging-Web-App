import cookie from "cookie";
import { authenticateAccess } from "../services/session.service.js";
import { isTrustedOrigin } from "../middlewares/csrf.js";
import User from "../models/User.js";

// Xác thực Socket.io bằng JWWT lưu trong token
// Socket chỉ connect nếu cookie có JWT hợp lệ → decode → tìm thấy user → gắn user vào socket
export async function authSocket(socket, next) {
  try {
    const origin = socket.handshake.headers.origin;
    if (origin && !isTrustedOrigin(origin)) throw Object.assign(new Error("UNTRUSTED_ORIGIN"), { code: "UNTRUSTED_ORIGIN" });
    const cookies = cookie.parse(socket.handshake.headers.cookie || "");
    const decoded = await authenticateAccess(cookies[process.env.COOKIE_NAME || "access_token"]);
    socket.auth = { sessionId: decoded.sid, expiresAt: decoded.exp * 1000, userId: decoded.sub };
    const user = await User.findById(decoded.sub).select(
      "_id name email role avatar"
    ); //decoded.sub = userId
    if (!user) return next(new Error("User not found"));

    // Gắn user vào Socket
    socket.user = {
      id: user._id.toString(),
      name: user.name,
      role: user.role,
      avatarUrl: user.avatar?.url || null,
    };

    next();
  } catch (error) {
    const failure = new Error(error.status === 401 ? error.code : "Socket auth failed");
    failure.data = { code: error.code || "AUTH_FAILED" };
    next(failure);
  }
}
