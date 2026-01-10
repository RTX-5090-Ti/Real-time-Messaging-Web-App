import multer from "multer";

// Memory storage so we can upload buffer to Cloudinary
const storage = multer.memoryStorage();

export const uploadSingle = multer({
  storage,
  limits: {
    // 25MB
    fileSize: 25 * 1024 * 1024,
  },
}).single("file");
