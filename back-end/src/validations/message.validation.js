import { body, query } from "express-validator";
import mongoose from "mongoose";

const ALLOWED_KINDS = ["image", "file", "gif", "sticker"];

// whitelist domain để user không nhét link linh tinh
function isTrustedGiphyUrl(u) {
  try {
    const url = new URL(u);
    if (url.protocol !== "https:") return false;

    // GIPHY thường dùng nhiều subdomain: media.giphy.com, i.giphy.com, media0.giphy.com...
    // => whitelist dạng *.giphy.com
    return url.hostname === "giphy.com" || url.hostname.endsWith(".giphy.com");
  } catch {
    return false;
  }
}

export const sendMessageRules = [
  body("conversationId")
    .custom((v) => mongoose.Types.ObjectId.isValid(v))
    .withMessage("conversationId không hợp lệ"),

  body("text").optional().isString(),

  body("replyTo")
    .optional({ nullable: true })
    .custom((v) => v === null || mongoose.Types.ObjectId.isValid(v))
    .withMessage("replyTo không hợp lệ"),

  body("attachments").optional().isArray(),

  body("attachments.*.kind")
    .optional()
    .isIn(ALLOWED_KINDS)
    .withMessage("attachments.kind không hợp lệ"),

  body("attachments.*.url")
    .optional()
    .isString()
    .withMessage("attachments.url phải là string"),

  // ✅ allow: text OR attachments
  body().custom((_, { req }) => {
    const text = String(req.body?.text || "").trim();
    const attachments = req.body?.attachments;
    const hasText = !!text;

    const hasAttachments =
      Array.isArray(attachments) &&
      attachments.some((a) => a && typeof a.url === "string" && a.url.trim());

    if (!hasText && !hasAttachments)
      throw new Error("text hoặc attachments là bắt buộc");
    return true;
  }),

  // ✅ Validate attachments details (GIF URL-only)
  body("attachments").custom((attachments) => {
    if (!Array.isArray(attachments)) return true;

    for (const a of attachments) {
      if (!a) continue;

      const kind = a.kind;
      const url = typeof a.url === "string" ? a.url.trim() : "";

      // if attachment exists => must have url + kind
      if (!kind || !ALLOWED_KINDS.includes(kind)) {
        throw new Error("attachments.kind không hợp lệ");
      }
      if (!url) throw new Error("attachments.url là bắt buộc");

      // GIF URL-only rules
      if (kind === "gif") {
        const provider = String(a.provider || "").trim();
        const gifId = String(a.gifId || "").trim();
        const preview = String(a.preview || "").trim();

        if (provider !== "giphy")
          throw new Error("gif.provider chỉ hỗ trợ 'giphy'");
        if (!gifId) throw new Error("gif.gifId là bắt buộc");
        if (!isTrustedGiphyUrl(url))
          throw new Error("gif.url không thuộc domain GIPHY");

        // preview optional but recommended; if present => must be trusted
        if (preview && !isTrustedGiphyUrl(preview)) {
          throw new Error("gif.preview không thuộc domain GIPHY");
        }

        // width/height optional but if present must be number >= 0
        const w = a.width;
        const h = a.height;
        if (w !== undefined && w !== null && Number(w) < 0)
          throw new Error("gif.width không hợp lệ");
        if (h !== undefined && h !== null && Number(h) < 0)
          throw new Error("gif.height không hợp lệ");

        const mp4 = a.mp4 ? String(a.mp4).trim() : "";
        if (mp4 && !isTrustedGiphyUrl(mp4)) {
          throw new Error("gif.mp4 không thuộc domain GIPHY");
        }
      }
    }

    return true;
  }),
];

export const getMessagesRules = [
  query("conversationId")
    .custom((v) => mongoose.Types.ObjectId.isValid(v))
    .withMessage("conversationId không hợp lệ"),

  // ✅ page size
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("limit phải là số 1..100"),

  // ✅ cursor time (ISO)
  query("before").optional().isISO8601().withMessage("before phải là ISO8601"),
];
