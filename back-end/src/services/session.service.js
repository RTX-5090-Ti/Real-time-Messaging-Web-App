import mongoose from "mongoose";
import { randomBytes, createHash } from "node:crypto";
import AuthSession from "../models/AuthSession.js";
import RefreshToken from "../models/RefreshToken.js";
import User from "../models/User.js";
import { signToken, verifyToken, accessTokenSeconds } from "../utils/jwt.js";
import { getIO } from "../sockets/io.js";

export const authError = code => Object.assign(new Error(code), { status: 401, code });
const hash = raw => createHash("sha256").update(raw).digest("hex");
const validRefresh = raw => typeof raw === "string" && /^[a-f0-9]{64}$/.test(raw);
const secret = () => randomBytes(32).toString("hex");

export function disconnectSession(id, code = "SESSION_REVOKED") {
  const io = getIO();
  if (!io) return;
  const room = `session:${id}`;
  io.to(room).emit("auth:revoked", { code });
  io.in(room).disconnectSockets(true);
}

export async function revokeSession(id) {
  await AuthSession.updateOne({ _id: id, revokedAt: null }, { $set: { revokedAt: new Date() } });
  disconnectSession(id);
}

function credentials(session, raw) {
  const seconds = Math.max(1, Math.min(accessTokenSeconds(), Math.floor((session.expiresAt - Date.now()) / 1000)));
  return { accessToken: signToken({ sub: String(session.userId), sid: String(session._id), type: "access" }, seconds),
    refreshToken: raw, accessMaxAge: seconds * 1000, refreshMaxAge: Math.max(0, session.expiresAt - Date.now()) };
}

export async function createSession(userId) {
  const raw = secret();
  const session = await mongoose.connection.transaction(async transaction => {
    const [session] = await AuthSession.create([{ userId, expiresAt: new Date(Date.now() + 7 * 86400000) }], { session: transaction });
    await RefreshToken.create([{ sessionId: session._id, tokenHash: hash(raw), expiresAt: session.expiresAt }], { session: transaction });
    return session;
  });
  return credentials(session, raw);
}

export async function rotateRefreshToken(raw) {
  if (!validRefresh(raw)) throw authError("INVALID_REFRESH_TOKEN");
  const next = secret();
  const result = await mongoose.connection.transaction(async transaction => {
    const token = await RefreshToken.findOne({ tokenHash: hash(raw) }).session(transaction);
    if (!token || token.expiresAt <= new Date()) throw authError("REFRESH_EXPIRED");
    const session = await AuthSession.findById(token.sessionId).session(transaction);
    if (!session || session.revokedAt || session.expiresAt <= new Date()) throw authError("SESSION_REVOKED");
    if (token.consumedAt) {
      session.revokedAt = new Date();
      await session.save({ session: transaction });
      return { reused: true, id: session._id };
    }
    if (!await User.exists({ _id: session.userId }).session(transaction)) throw authError("SESSION_REVOKED");
    token.consumedAt = new Date();
    session.lastUsedAt = new Date();
    await session.save({ session: transaction }); // Serialize rotation against logout/reuse.
    await token.save({ session: transaction });
    await RefreshToken.create([{ sessionId: session._id, tokenHash: hash(next), expiresAt: session.expiresAt }], { session: transaction });
    return { session };
  });
  if (result.reused) {
    disconnectSession(result.id, "REFRESH_REUSED");
    throw authError("REFRESH_REUSED");
  }
  return credentials(result.session, next);
}

export async function assertSessionActive(sessionId, userId) {
  if (!sessionId || !userId || !await AuthSession.exists({ _id: sessionId, userId, revokedAt: null, expiresAt: { $gt: new Date() } }))
    throw authError("SESSION_REVOKED");
}

export async function authenticateAccess(token) {
  if (!token) throw authError("NO_ACCESS_TOKEN");
  let decoded;
  try { decoded = verifyToken(token); }
  catch (error) { throw authError(error.name === "TokenExpiredError" ? "ACCESS_EXPIRED" : "INVALID_ACCESS_TOKEN"); }
  if (decoded.type !== "access" || !mongoose.isObjectIdOrHexString(decoded.sid) || !mongoose.isObjectIdOrHexString(decoded.sub))
    throw authError("INVALID_ACCESS_TOKEN");
  await assertSessionActive(decoded.sid, decoded.sub);
  return decoded;
}

export async function revokeFromCookies(access, refresh) {
  const ids = new Set();
  if (access) {
    try { const decoded = verifyToken(access, { ignoreExpiration: true });
      if (decoded.type === "access" && mongoose.isObjectIdOrHexString(decoded.sid)) ids.add(decoded.sid);
    } catch { /* Refresh cookie may still identify the session. */ }
  }
  if (validRefresh(refresh)) {
    const token = await RefreshToken.findOne({ tokenHash: hash(refresh) });
    if (token) ids.add(String(token.sessionId));
  }
  for (const id of ids) await revokeSession(id);
}
