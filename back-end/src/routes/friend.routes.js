import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import {
  listFriends,
  listIncomingRequests,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
} from "../controllers/friend.controller.js";

const router = Router();

router.get("/", requireAuth, listFriends);

router.get("/requests/incoming", requireAuth, listIncomingRequests);
router.post("/requests", requireAuth, sendFriendRequest);
router.post("/requests/:id/accept", requireAuth, acceptFriendRequest);
router.post("/requests/:id/reject", requireAuth, rejectFriendRequest);
router.post("/requests/:id/cancel", requireAuth, cancelFriendRequest);

export default router;
