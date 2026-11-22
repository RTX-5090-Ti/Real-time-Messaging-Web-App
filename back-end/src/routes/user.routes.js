import { httpLimit, limitUpload } from "../middlewares/rateLimit.js";
import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import {
  listUsers,
  searchUserByEmail,
  getMe,
  getUserById,
  updateMe,
  updateMyAvatar,
} from "../controllers/user.controller.js";
import { uploadSingle } from "../middlewares/upload.middleware.js";

const router = Router();

router.get("/", requireAuth, listUsers);
router.get("/search", requireAuth, searchUserByEmail);

//  profile
router.get("/me", requireAuth, getMe);
router.patch("/me", requireAuth, updateMe);
router.patch("/me/avatar", requireAuth, httpLimit(limitUpload), uploadSingle, updateMyAvatar);

router.get("/:id", requireAuth, getUserById);

export default router;
