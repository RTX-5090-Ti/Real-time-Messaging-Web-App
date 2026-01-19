import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { validate } from "../middlewares/validate.js";
import {
  createDirectRules,
  createGroupRules,
} from "../validations/conversation.validation.js";
import {
  createOrGetDirect,
  createGroup,
  listMyConversations,
  deleteConversationForMe,
  leaveGroup,
  addGroupMember,
  kickGroupMember,
  makeGroupAdmin,
  removeGroupAdmin,
  updateGroupProfile,
} from "../controllers/conversation.controller.js";

const router = Router();

router.get("/", requireAuth, listMyConversations);
router.delete("/:id", requireAuth, deleteConversationForMe);

router.post(
  "/direct",
  requireAuth,
  createDirectRules,
  validate,
  createOrGetDirect,
);

router.post("/group", requireAuth, createGroupRules, validate, createGroup);

router.post("/:id/leave", requireAuth, leaveGroup);

router.post("/:id/members", requireAuth, addGroupMember);

//  Kick member (Owner only)
router.delete("/:id/members/:userId", requireAuth, kickGroupMember);

//  Admin controls (Owner only - chuẩn bị sẵn)
router.post("/:id/admins/:userId", requireAuth, makeGroupAdmin);
router.delete("/:id/admins/:userId", requireAuth, removeGroupAdmin);

router.patch("/:id/profile", requireAuth, updateGroupProfile);

export default router;
