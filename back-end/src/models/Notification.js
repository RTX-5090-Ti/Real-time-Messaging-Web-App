import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "friend_request",
        "friend_request_accepted",
        "friend_request_rejected",
      ],
      required: true,
    },
    data: { type: Object, default: {} }, // lưu info cần hiển thị: from/by, requestId, message...
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
