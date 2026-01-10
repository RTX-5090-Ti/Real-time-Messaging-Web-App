import express from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import {
  listMyNotifications,
  markAllRead,
} from "../controllers/notification.controller.js";

const router = express.Router();

router.get("/", requireAuth, listMyNotifications);
router.post("/read-all", requireAuth, markAllRead);

export default router;
