import mongoose from "mongoose";

const participantSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lastReadAt: { type: Date, default: null },
    // When user deletes/clears chat, they won't see messages older than this.
    clearedAt: { type: Date, default: null },
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["direct"], default: "direct" },
    members: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ],
    lastMessageAt: { type: Date, default: null },
    // User nào đã 'delete chat' (ẩn hội thoại với riêng họ)
    hiddenFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    directKey: { type: String, default: null },
    // Theo dõi lượt đọc từng User
    participants: { type: [participantSchema], default: [] },
  },

  {
    timestamps: true,
  }
);
// đảm bảo direct 1-1 có đúng 2 người
conversationSchema.index(
  { type: 1, directKey: 1 },
  { unique: true, sparse: true }
);

export default mongoose.model("Conversation", conversationSchema);
