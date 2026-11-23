import "dotenv/config";
import http from "http";
import { Server } from "socket.io";

import app from "./app.js";
import { connectDB } from "./config/db.js";
import { initSocket } from "./sockets/index.js";
import { setIO } from "./sockets/io.js";
import AuthSession from "./models/AuthSession.js";
import RefreshToken from "./models/RefreshToken.js";

const PORT = process.env.PORT || 5000;

await connectDB(process.env.MONGO_URI);
await Promise.all([AuthSession.init(), RefreshToken.init()]);

const httpSever = http.createServer(app);

const io = new Server(httpSever, {
  cors: {
    origin: process.env.CLIENT_ORIGIN,
    credentials: true,
  },
});

process.on("unhandledRejection", (err) =>
  console.error("unhandledRejection", err)
);
process.on("uncaughtException", (err) =>
  console.error("uncaughtException", err)
);

setIO(io);
initSocket(io);

httpSever.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});
