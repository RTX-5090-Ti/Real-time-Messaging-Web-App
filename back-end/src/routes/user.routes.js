import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import {
  listUsers,
  searchUserByEmail,
} from "../controllers/user.controller.js";

const router = Router();

router.get("/", requireAuth, listUsers);
router.get("/search", requireAuth, searchUserByEmail);

export default router;
