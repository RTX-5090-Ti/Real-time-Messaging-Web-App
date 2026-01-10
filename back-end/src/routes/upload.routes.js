import { Router } from "express";

import { requireAuth } from "../middlewares/requireAuth.js";
import { uploadSingle } from "../middlewares/upload.middleware.js";
import {
  uploadSingleFile,
  deleteUploadedFile,
} from "../controllers/upload.controller.js";

const router = Router();

// POST /upload/single (multipart/form-data, field name: file)
router.post("/single", requireAuth, uploadSingle, uploadSingleFile);

// DELETE /upload/delete (JSON) { publicId, resourceType }
router.delete("/delete", requireAuth, deleteUploadedFile);

export default router;
