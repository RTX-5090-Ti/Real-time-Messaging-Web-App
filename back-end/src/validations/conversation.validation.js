import { body } from "express-validator";
import mongoose from "mongoose";

export const createDirectRules = [
  body("otherUserId")
    .notEmpty()
    .withMessage("otherUserId là bắt buộc")
    .custom((val) => mongoose.Types.ObjectId.isValid(val))
    .withMessage("otherUserId không hợp lệ"),
];
