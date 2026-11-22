import { query } from "express-validator";
import mongoose from "mongoose";

export const getMessagesRules = [
  query("conversationId")
    .custom((v) => mongoose.Types.ObjectId.isValid(v))
    .withMessage("conversationId không hợp lệ"),

  // ✅ page size
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("limit phải là số 1..100"),

  // ✅ cursor time (ISO)
  query("before").optional().isISO8601().withMessage("before phải là ISO8601"),
];
