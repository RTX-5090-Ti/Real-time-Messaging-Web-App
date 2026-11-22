import mongoose from "mongoose";

export function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}

export function objectId(value, name = "id") {
  if (typeof value !== "string" || !/^[a-f\d]{24}$/i.test(value) || !mongoose.Types.ObjectId.isValid(value))
    fail(`INVALID_${name.toUpperCase()}`);
  return value;
}

export function messageText(value, required = false) {
  if (value !== undefined && typeof value !== "string") fail("INVALID_TEXT");
  const text = (value || "").trim();
  if (text.length > 10000) fail("TEXT_TOO_LONG");
  if (required && !text) fail("EMPTY_TEXT");
  return text;
}

function safeUrl(value, giphy = false) {
  if (typeof value !== "string" || value.length > 2048) fail("INVALID_URL");
  let url;
  try { url = new URL(value); } catch { fail("INVALID_URL"); }
  if (url.protocol !== "https:" || url.username || url.password) fail("INVALID_URL");
  if (giphy && url.hostname !== "giphy.com" && !url.hostname.endsWith(".giphy.com")) fail("INVALID_GIPHY_URL");
  return url.href;
}

export function validateSend(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("INVALID_PAYLOAD");
  const conversationId = objectId(input.conversationId, "conversationId");
  if (typeof input.clientId !== "string" || !/^[\w-]{1,128}$/.test(input.clientId)) fail("INVALID_CLIENT_ID");
  const text = messageText(input.text);
  const raw = input.attachments ?? [];
  if (!Array.isArray(raw) || raw.length > 10) fail("INVALID_ATTACHMENTS");
  const attachments = raw.map((a) => {
    if (!a || !["image", "file", "gif", "sticker"].includes(a.kind)) fail("INVALID_ATTACHMENT_KIND");
    const gif = a.kind === "gif";
    if (gif && (a.provider !== "giphy" || typeof a.gifId !== "string" || !a.gifId || a.gifId.length > 128)) fail("INVALID_GIF");
    const result = { kind: a.kind, url: safeUrl(a.url, gif) };
    for (const key of ["name", "mime"]) {
      if (a[key] !== undefined && (typeof a[key] !== "string" || a[key].length > 255)) fail("INVALID_ATTACHMENT");
      result[key] = a[key] || "";
    }
    for (const key of ["size", "width", "height"]) {
      const value = a[key] ?? 0;
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > (key === "size" ? 25 * 1024 * 1024 : 100000)) fail("INVALID_ATTACHMENT");
      result[key] = value;
    }
    if (gif) Object.assign(result, { provider: "giphy", gifId: a.gifId,
      preview: a.preview ? safeUrl(a.preview, true) : "", mp4: a.mp4 ? safeUrl(a.mp4, true) : "" });
    return result;
  });
  if (!text && !attachments.length) fail("EMPTY_MESSAGE");
  return { conversationId, clientId: input.clientId, text, attachments,
    replyTo: input.replyTo ? objectId(input.replyTo, "replyTo") : null };
}
