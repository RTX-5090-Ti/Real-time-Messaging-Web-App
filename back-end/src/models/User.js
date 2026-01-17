import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    email: {
      type: String,
      trim: true,
      required: true,
      unique: true,
      lowercase: true,
    },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    // Danh sách bạn đã accept
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // ✅ Profile fields (optional)
    gender: { type: String, enum: ["male", "female"], trim: true },
    // lưu dạng string để khỏi lệch timezone: "YYYY-MM-DD"
    dob: { type: String, trim: true },
    avatar: {
      url: { type: String, trim: true },
      publicId: { type: String, trim: true },
      resourceType: { type: String, trim: true, default: "image" },
    },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
