import "dotenv/config";
import { spawn } from "node:child_process";

if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required for integration tests.");
const child = spawn(process.execPath, ["--test", "test/chat.test.js", "test/transport.test.js", "test/auth.test.js"], {
  stdio: "inherit", env: { ...process.env, CHAT_TEST_DB: "1" },
});
child.on("error", error => { console.error(error.message); process.exitCode = 1; });
child.on("exit", code => { process.exitCode = code ?? 1; });
