// Shared by HTTP and Socket.IO on this server. Use a shared store when scaling out.
export function createLimiter(limit, windowMs) {
  const entries = new Map();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of entries) if (entry.reset <= now) entries.delete(key);
  }, windowMs);
  timer.unref();
  return (key) => {
    const now = Date.now();
    let entry = entries.get(key);
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs };
      entries.set(key, entry);
    }
    if (++entry.count > limit) throw Object.assign(new Error("RATE_LIMITED"), {
      status: 429, retryAfter: Math.ceil((entry.reset - now) / 1000),
    });
  };
}
export const limitRefresh = createLimiter(120, 15 * 60 * 1000);
export const limitAuth = createLimiter(20, 15 * 60 * 1000);
export const limitMessage = createLimiter(60, 60 * 1000);
export const limitTyping = createLimiter(120, 60 * 1000);
export const limitUpload = createLimiter(30, 60 * 1000);
export const limitSocket = createLimiter(300, 60 * 1000);
export const httpLimit = (limiter) => (req, res, next) => {
  try { limiter(String(req.user?.id || req.ip)); next(); }
  catch (err) { res.set("Retry-After", String(err.retryAfter)); next(err); }
};
