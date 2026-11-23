import mongoose from "mongoose";

const schema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "AuthSession", required: true, index: true },
  tokenHash: { type: String, required: true, unique: true, select: false },
  consumedAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default mongoose.model("RefreshToken", schema);
