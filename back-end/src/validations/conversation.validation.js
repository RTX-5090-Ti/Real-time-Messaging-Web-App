import { body } from "express-validator";
import mongoose from "mongoose";

export const createDirectRules = [
  body("otherUserId")
    .notEmpty()
    .withMessage("otherUserId là bắt buộc")
    .custom((val) => mongoose.Types.ObjectId.isValid(val))
    .withMessage("otherUserId không hợp lệ"),
];

// Create group conversation
export const createGroupRules = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("name là bắt buộc")
    .isLength({ min: 1, max: 80 })
    .withMessage("name phải từ 1-80 ký tự"),

  body("memberIds")
    .isArray({ min: 2 })
    .withMessage("memberIds phải là mảng và tối thiểu 2 người"),

  body("memberIds.*")
    .custom((val) => mongoose.Types.ObjectId.isValid(val))
    .withMessage("memberId không hợp lệ"),
];
