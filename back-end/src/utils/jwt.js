import jwt from "jsonwebtoken";

export function accessTokenSeconds() {
  const seconds = Number(process.env.ACCESS_TOKEN_TTL_SECONDS || 900);
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > 900) throw new Error("ACCESS_TOKEN_TTL_SECONDS must be 1..900");
  return seconds;
}
export function signToken(payload, seconds = accessTokenSeconds()) {
  return jwt.sign(payload, process.env.JWT_SECRET, { algorithm: "HS256", expiresIn: seconds,
    issuer: "chat-app", audience: "chat-app-client" });
}
export function verifyToken(token, options = {}) {
  return jwt.verify(token, process.env.JWT_SECRET, { ...options, algorithms: ["HS256"], issuer: "chat-app", audience: "chat-app-client" });
}
