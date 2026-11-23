export const accessCookieName = () => process.env.COOKIE_NAME || "access_token";
export const refreshCookieName = () => process.env.REFRESH_COOKIE_NAME || "refresh_token";
export function getCookieOptions(refresh = false) {
  const isProd = process.env.NODE_ENV === "production";
  return { httpOnly: true, sameSite: isProd ? "none" : "lax", secure: isProd, path: refresh ? "/auth" : "/" };
}
export function setAuthCookies(res, credentials) {
  res.set("Cache-Control", "no-store");
  res.cookie(accessCookieName(), credentials.accessToken, { ...getCookieOptions(), maxAge: credentials.accessMaxAge });
  res.cookie(refreshCookieName(), credentials.refreshToken, { ...getCookieOptions(true), maxAge: credentials.refreshMaxAge });
}
export function clearAuthCookies(res) {
  res.set("Cache-Control", "no-store");
  res.clearCookie(accessCookieName(), getCookieOptions());
  res.clearCookie(refreshCookieName(), getCookieOptions(true));
}
