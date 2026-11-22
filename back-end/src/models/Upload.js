import mongoose from "mongoose";

const schema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  publicId: { type: String, required: true },
  resourceType: { type: String, enum: ["image", "raw"], required: true },
  url: { type: String, required: true },
}, { timestamps: true });
schema.index({ publicId: 1, resourceType: 1 }, { unique: true });
export default mongoose.model("Upload", schema);
