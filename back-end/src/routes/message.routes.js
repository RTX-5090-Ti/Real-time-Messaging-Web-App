import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { validate } from "../middlewares/validate.js";
import { getMessages, sendMessage } from "../controllers/message.controller.js";
import {
  getMessagesRules,
  sendMessageRules,
} from "../validations/message.validation.js";
import {
  editMessage,
  recallMessage,
  togglePinMessage,
} from "../controllers/message.controller.js";

const router = Router();

router.get("/", requireAuth, getMessagesRules, validate, getMessages);
router.post("/", requireAuth, sendMessageRules, validate, sendMessage);

router.patch("/:id", requireAuth, editMessage);
router.post("/:id/recall", requireAuth, recallMessage);
router.post("/:id/pin", requireAuth, togglePinMessage);

export default router;
