import { requireTrustedOrigin } from "../middlewares/csrf.js";
import { httpLimit, limitAuth, limitRefresh } from "../middlewares/rateLimit.js";
import { Router } from "express";
import { register, login, logout, refresh } from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { validate } from "../middlewares/validate.js";
import { registerRules, loginRules } from "../validations/auth.validation.js";

const router = Router();

router.post("/register", requireTrustedOrigin, httpLimit(limitAuth), registerRules, validate, register);
router.post("/login", requireTrustedOrigin, httpLimit(limitAuth), loginRules, validate, login);
router.post("/logout", requireTrustedOrigin, logout);
router.post("/refresh", requireTrustedOrigin, httpLimit(limitRefresh), refresh);
router.get("/me", requireAuth, (req, res) => res.json({ user: req.user }));

export default router;
