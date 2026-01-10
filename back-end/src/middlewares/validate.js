import { validationResult } from "express-validator";

// Validate dữ liệu request
export function validate(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const errors = result.array().reduce((acc, e) => {
    acc[e.path] = e.msg;
    return acc;
  }, {});
  return res.status(400).json({
    message: "Dữ liệu không hợp lệ",
    errors,
  });
}
