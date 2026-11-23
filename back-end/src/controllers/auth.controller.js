import bcrypt from "bcrypt";
import User from "../models/User.js";
import { createSession, rotateRefreshToken, revokeFromCookies } from "../services/session.service.js";
import { setAuthCookies, clearAuthCookies, accessCookieName, refreshCookieName } from "../utils/cookie.js";

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

  await revokeFromCookies(req.cookies?.[accessCookieName()], req.cookies?.[refreshCookieName()]);
  setAuthCookies(res, await createSession(user._id));

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

  await revokeFromCookies(req.cookies?.[accessCookieName()], req.cookies?.[refreshCookieName()]);
  setAuthCookies(res, await createSession(user._id));

  return res.json({ message: "Login thành công", user: safeUser(user) });
}

// Đăng xuất
export async function logout(req, res) {
  await revokeFromCookies(req.cookies?.[accessCookieName()], req.cookies?.[refreshCookieName()]);
  clearAuthCookies(res);
  return res.json({ ok: true });
}

export async function refresh(req, res, next) {
  try {
    setAuthCookies(res, await rotateRefreshToken(req.cookies?.[refreshCookieName()]));
    return res.json({ ok: true });
  } catch (error) {
    if (error.status === 401) clearAuthCookies(res);
    next(error);
  }
}
