import bcrypt from "bcrypt";
import User from "../models/User.js";
import { signToken } from "../utils/jwt.js";
import { getCookieOptions } from "../utils/cookie.js";

function safeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

// Đăng kí
export async function register(req, res) {
  const { name, email, password } = req.body;

  const exists = await User.findOne({ email });
  if (exists) return res.status(409).json({ message: "Email đã tồn tại" });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash });

  const token = signToken({ sub: user._id.toString(), role: user.role });
  res.cookie(
    process.env.COOKIE_NAME || "access_token",
    token,
    getCookieOptions()
  );

  return res
    .status(201)
    .json({ message: "Register thành công", user: safeUser(user) });
}

// Đăng nhập
export async function login(req, res) {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user)
    return res.status(401).json({ message: "Sai email hoặc password" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: "Sai email hoặc password" });

  const token = signToken({ sub: user._id.toString(), role: user.role });
  res.cookie(
    process.env.COOKIE_NAME || "access_token",
    token,
    getCookieOptions()
  );

  return res.json({ message: "Login thành công", user: safeUser(user) });
}

// Đăng xuất
export async function logout(req, res) {
  const name = process.env.COOKIE_NAME || "access_token";
  res.clearCookie(name, getCookieOptions()); // dùng đúng options lúc set cookie
  return res.json({ message: "Logout thành công" });
}
