import bcrypt from "bcrypt";
import mongoose from "mongoose";
import AuthSession from "../models/AuthSession.js";
import User from "../models/User.js";
import { createSession, rotateRefreshToken, revokeFromCookies, disconnectSession } from "../services/session.service.js";
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
  setAuthCookies(res, await createSession(user._id, req.get("user-agent")));

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
  setAuthCookies(res, await createSession(user._id, req.get("user-agent")));

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

export async function listSessions(req, res) {
  const sessions = await AuthSession.find({ userId: req.user.id, revokedAt: null, expiresAt: { $gt: new Date() } })
    .select("device createdAt lastUsedAt expiresAt").sort({ lastUsedAt: -1 }).lean();
  res.set("Cache-Control", "no-store");
  return res.json({ sessions: sessions.map(session => ({
    id: String(session._id), current: String(session._id) === req.auth.sid,
    device: session.device || null, createdAt: session.createdAt,
    lastUsedAt: session.lastUsedAt, expiresAt: session.expiresAt,
  })).sort((a, b) => Number(b.current) - Number(a.current)) });
}

export async function revokeOtherSessions(req, res) {
  // Freeze the target set: a subsequent login is a new session, not part of this action.
  const filter = { userId: req.user.id, _id: { $ne: req.auth.sid }, revokedAt: null, expiresAt: { $gt: new Date() } };
  const sessions = await AuthSession.find(filter).select("_id").lean();
  await AuthSession.updateMany({ ...filter, _id: { $in: sessions.map(s => s._id) } }, { $set: { revokedAt: new Date() } });
  sessions.forEach(session => disconnectSession(session._id));
  return res.json({ ok: true });
}

export async function revokeManagedSession(req, res) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) return res.status(400).json({ message: "Phiên đăng nhập không hợp lệ" });
  const session = await AuthSession.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, { $set: { revokedAt: new Date() } });
  if (!session) return res.status(404).json({ message: "Không tìm thấy phiên đăng nhập" });
  disconnectSession(session._id);
  if (String(session._id) === req.auth.sid) clearAuthCookies(res);
  return res.json({ ok: true });
}
