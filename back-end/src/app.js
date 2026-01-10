import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import conversationRoutes from "./routes/conversation.routes.js";
import messageRoutes from "./routes/message.routes.js";
import friendRoutes from "./routes/friend.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import uploadRoutes from "./routes/upload.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN,
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    message: "API is runninng",
  });
});

app.use("/auth", authRoutes);

app.use("/users", userRoutes);
app.use("/conversations", conversationRoutes);

app.use("/messages", messageRoutes);

app.use("/friends", friendRoutes);

app.use("/notifications", notificationRoutes);

// upload endpoint
app.use("/upload", uploadRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ message: "Not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    message: err.message || "Server error",
  });
});

export default app;
