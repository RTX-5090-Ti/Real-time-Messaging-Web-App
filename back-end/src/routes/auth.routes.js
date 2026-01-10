import { Router } from "express";
import { register, login, logout } from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { validate } from "../middlewares/validate.js";
import { registerRules, loginRules } from "../validations/auth.validation.js";

const router = Router();

router.post("/register", registerRules, validate, register);
router.post("/login", loginRules, validate, login);
router.post("/logout", logout);
router.get("/me", requireAuth, (req, res) => res.json({ user: req.user }));

export default router;
