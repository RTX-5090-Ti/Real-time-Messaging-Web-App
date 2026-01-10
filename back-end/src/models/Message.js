import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema(
  {
    // image | file | gif | sticker (future)
    kind: {
      type: String,
      enum: ["image", "file", "gif", "sticker"],
      required: true,
    },

    // Common
    url: { type: String, required: true },
    name: { type: String, default: "" },
    mime: { type: String, default: "" },
    size: { type: Number, default: 0 },

    // ===== GIF URL-only metadata (provider-backed) =====
    provider: {
      type: String,
      enum: ["giphy", ""],
      default: "",
    },
    gifId: { type: String, default: "" },
    preview: { type: String, default: "" },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },

    // Optional: if later you want mp4/webm for smoother playback
    mp4: { type: String, default: "" },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // text is optional if attachments exist
    text: { type: String, trim: true, default: "" },
    attachments: { type: [attachmentSchema], default: [] },
  },
  { timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ conversationId: 1, senderId: 1, createdAt: -1 });

export default mongoose.model("Message", messageSchema);
