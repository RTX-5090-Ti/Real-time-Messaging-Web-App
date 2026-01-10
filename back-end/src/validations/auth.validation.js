import { body } from "express-validator";

export const registerRules = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("name là bắt buộc")
    .isLength({
      min: 2,
    })
    .withMessage("name tối  thiểu  2 kí tự"),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("email là bắt buộc")
    .isEmail()
    .withMessage("email không hợp lệ")
    .normalizeEmail(),

  body("password")
    .notEmpty()
    .withMessage("password là bắt buộc")
    .isLength({ min: 6 })
    .withMessage("password tối thiếu 6 kí tự"),
];

export const loginRules = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("email là bắt buộc")
    .isEmail()
    .withMessage("email không hợp lệ")
    .normalizeEmail(),

  body("password").notEmpty().withMessage("password là bắt buộc"),
];
