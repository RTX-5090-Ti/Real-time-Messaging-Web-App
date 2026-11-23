export function isTrustedOrigin(origin) {
  const allowed = (process.env.CLIENT_ORIGIN || "http://localhost:5173").split(",").map(x => x.trim());
  return allowed.includes(origin);
}
// Auth mutations always require Origin; browsers set it and JS cannot forge it.
export function requireTrustedOrigin(req, res, next) {
  if (!isTrustedOrigin(req.get("origin"))) return res.status(403).json({ code: "UNTRUSTED_ORIGIN", message: "Untrusted origin" });
  next();
}
