import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ["image", "file", "gif", "sticker"],
      required: true,
    },
    url: { type: String, required: true },
    name: { type: String, default: "" },
    mime: { type: String, default: "" },
    size: { type: Number, default: 0 },

    provider: { type: String, enum: ["giphy", ""], default: "" },
    gifId: { type: String, default: "" },
    preview: { type: String, default: "" },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    mp4: { type: String, default: "" },
  },
  { _id: false }
);

const reactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    emoji: {
      type: String,
      enum: ["❤️", "😆", "😮", "😭", "👍"],
      required: true,
    },
    reactedAt: { type: Date, default: Date.now },
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

    kind: { type: String, enum: ["user", "system"], default: "user" },

    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      required: function () {
        return this.kind !== "system";
      },
    },

    system: {
      type: { type: String, default: "" }, // member_added | member_left | ...
      actorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      actorName: { type: String, default: "" },
      targetId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      targetName: { type: String, default: "" },
    },

    text: { type: String, trim: true, default: "" },
    attachments: { type: [attachmentSchema], default: [] },

    //  Reply
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    //  Reaction
    reactions: { type: [reactionSchema], default: [] },

    //  Pin
    pinned: { type: Boolean, default: false },
    pinnedAt: { type: Date, default: null },
    pinnedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    //  Edit
    editedAt: { type: Date, default: null },

    //  Recall
    isRecalled: { type: Boolean, default: false },
    recalledAt: { type: Date, default: null },
    recalledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },

  { timestamps: true }
);

messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ conversationId: 1, senderId: 1, createdAt: -1 });

export default mongoose.model("Message", messageSchema);
