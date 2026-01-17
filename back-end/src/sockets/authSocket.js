import cookie from "cookie";
import { verifyToken } from "../utils/jwt.js";
import User from "../models/User.js";

// Xác thực Socket.io bằng JWWT lưu trong token
// Socket chỉ connect nếu cookie có JWT hợp lệ → decode → tìm thấy user → gắn user vào socket
export async function authSocket(socket, next) {
  try {
    const cookieHeader = socket.handshake.headers.cookie;
    if (!cookieHeader) return next(new Error("No cookie"));

    const cookies = cookie.parse(cookieHeader);
    const token = cookies[process.env.COOKIE_NAME || "access_token"];
    if (!token) return next(new Error("No token"));

    const decoded = verifyToken(token);
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
  } catch {
    next(new Error("Socket auth failed"));
  }
}
