import mongoose from "mongoose";

const participantSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lastReadAt: { type: Date, default: null },
    clearedAt: { type: Date, default: null },
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema(
  {
    // direct: 1-1 chat | group: group chat
    type: { type: String, enum: ["direct", "group"], default: "direct" },

    // ===== Group fields (only used when type === "group")
    name: { type: String, trim: true, default: null },
    avatar: {
      url: { type: String, trim: true, default: null },
      publicId: { type: String, trim: true, default: null },
      resourceType: { type: String, trim: true, default: "image" },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    members: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ],
    lastMessageAt: { type: Date, default: null },
    hiddenFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    directKey: { type: String, default: null },
    participants: { type: [participantSchema], default: [] },
  },
  { timestamps: true }
);

// direct unique key
conversationSchema.index(
  { type: 1, directKey: 1 },
  { unique: true, sparse: true }
);

// speed up query by members
conversationSchema.index({ members: 1 });

export default mongoose.model("Conversation", conversationSchema);
