import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { validate } from "../middlewares/validate.js";
import { createDirectRules } from "../validations/conversation.validation.js";
import {
  createOrGetDirect,
  listMyConversations,
  deleteConversationForMe,
} from "../controllers/conversation.controller.js";

const router = Router();

router.get("/", requireAuth, listMyConversations);
router.delete("/:id", requireAuth, deleteConversationForMe);

router.post(
  "/direct",
  requireAuth,
  createDirectRules,
  validate,
  createOrGetDirect
);

export default router;
