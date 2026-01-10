import mongoose from "mongoose";

const friendRequestSchema = new mongoose.Schema(
  {
    fromUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    toUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "canceled"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// Index để query nhanh
friendRequestSchema.index({ fromUserId: 1, toUserId: 1, status: 1 });
friendRequestSchema.index({ toUserId: 1, status: 1, createdAt: -1 });

export default mongoose.model("FriendRequest", friendRequestSchema);
