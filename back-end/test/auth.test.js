import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import http from "node:http";
import mongoose from "mongoose";
import { Server } from "socket.io";
import { io as clientIO } from "socket.io-client";
import app from "../src/app.js";
import User from "../src/models/User.js";
import AuthSession from "../src/models/AuthSession.js";
import RefreshToken from "../src/models/RefreshToken.js";
import { createSession, rotateRefreshToken, authenticateAccess } from "../src/services/session.service.js";
import { signToken, verifyToken } from "../src/utils/jwt.js";
import { accessCookieName, refreshCookieName, getCookieOptions } from "../src/utils/cookie.js";
import { initSocket } from "../src/sockets/index.js";
import { setIO } from "../src/sockets/io.js";

test("production cookies use HttpOnly, Secure and scoped refresh path", () => {
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    assert.deepEqual(getCookieOptions(true), { httpOnly: true, secure: true, sameSite: "none", path: "/auth" });
    assert.equal(getCookieOptions().path, "/");
  } finally { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; }
});

test("session authentication and refresh integration", { skip: process.env.CHAT_TEST_DB !== "1", timeout: 90000 }, async t => {
  process.env.JWT_SECRET = randomUUID();
  process.env.ACCESS_TOKEN_TTL_SECONDS = "900";
  const dbName = `chat_test_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
  const server = http.createServer(app);
  const io = new Server(server);
  const clients = [];
  setIO(io);
  initSocket(io);
  const cookie = pair => `${accessCookieName()}=${pair.accessToken}; ${refreshCookieName()}=${pair.refreshToken}`;
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName, autoIndex: false, serverSelectionTimeoutMS: 10000 });
    await Promise.all([User, AuthSession, RefreshToken].map(m => m.createIndexes()));
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const url = `http://127.0.0.1:${server.address().port}`;
    async function request(path, pair, { method = "POST", origin = process.env.CLIENT_ORIGIN || "http://localhost:5173", body } = {}) {
      const response = await fetch(`${url}${path}`, { method, headers: {
        ...(origin ? { Origin: origin } : {}), ...(pair ? { Cookie: cookie(pair) } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000) });
      const headers = response.headers.getSetCookie();
      const parsed = Object.fromEntries(headers.map(value => value.split(";")[0].split("=")));
      return { status: response.status, data: await response.json(), headers,
        pair: { accessToken: parsed[accessCookieName()], refreshToken: parsed[refreshCookieName()] } };
    }
    async function socket(pair) {
      const client = clientIO(url, { transports: ["websocket"], extraHeaders: { Cookie: cookie(pair) }, reconnection: false, autoConnect: false });
      clients.push(client);
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("connect timeout")), 5000);
        client.once("connect", () => { clearTimeout(timer); resolve(); });
        client.once("connect_error", error => { clearTimeout(timer); reject(error); });
        client.connect();
      });
      return client;
    }
    function receive(client, event) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Missing ${event}`)), 5000);
        client.once(event, data => { clearTimeout(timer); resolve(data); });
      });
    }
    const signup = await request("/auth/register", null, { body: { name: "Token Test", email: "token@example.test", password: "test-password-123" } });
    assert.equal(signup.status, 201);
    const userId = signup.data.user.id;

    await t.test("register issues short access and 7-day opaque refresh; DB stores hashes only", async () => {
      const decoded = verifyToken(signup.pair.accessToken);
      assert.equal(decoded.exp - decoded.iat, 900);
      assert.equal(decoded.type, "access");
      assert.match(signup.pair.refreshToken, /^[a-f0-9]{64}$/);
      const stored = await RefreshToken.findOne({ sessionId: decoded.sid }).select("+tokenHash").lean();
      assert.equal(stored.tokenHash, createHash("sha256").update(signup.pair.refreshToken).digest("hex"));
      assert.ok(!JSON.stringify(stored).includes(signup.pair.refreshToken));
      assert.ok(stored.expiresAt - Date.now() > 6.9 * 86400000);
      assert.ok(signup.headers.every(h => h.includes("HttpOnly")));
      assert.ok(signup.headers.some(h => h.includes("Path=/auth")));
    });

    await t.test("expired access refreshes without access credentials and rotates refresh cookie", async () => {
      const decoded = verifyToken(signup.pair.accessToken);
      const expired = { ...signup.pair, accessToken: signToken({ sub: userId, sid: decoded.sid, type: "access" }, -1) };
      assert.equal((await request("/auth/me", expired, { method: "GET" })).data.code, "ACCESS_EXPIRED");
      const refreshed = await request("/auth/refresh", { accessToken: "", refreshToken: expired.refreshToken });
      assert.equal(refreshed.status, 200);
      assert.notEqual(refreshed.pair.refreshToken, expired.refreshToken);
      assert.equal((await request("/auth/me", refreshed.pair, { method: "GET" })).status, 200);
      const replay = await request("/auth/refresh", expired);
      assert.equal(replay.data.code, "REFRESH_REUSED");
      assert.equal((await request("/auth/me", refreshed.pair, { method: "GET" })).data.code, "SESSION_REVOKED");
    });

    await t.test("refresh rejects missing/untrusted origins before consuming token", async () => {
      const pair = await createSession(userId);
      for (const origin of [null, "https://evil.example"]) assert.equal((await request("/auth/refresh", pair, { origin })).status, 403);
      assert.equal((await request("/auth/logout", pair, { origin: "https://evil.example" })).status, 403);
      assert.equal((await request("/auth/refresh", pair)).status, 200);
    });

    await t.test("concurrent reuse cannot issue two valid successor sessions", async () => {
      const pair = await createSession(userId);
      const results = await Promise.allSettled([rotateRefreshToken(pair.refreshToken), rotateRefreshToken(pair.refreshToken)]);
      const success = results.filter(r => r.status === "fulfilled");
      assert.equal(success.length, 1);
      assert.equal(results.find(r => r.status === "rejected").reason.code, "REFRESH_REUSED");
      await assert.rejects(authenticateAccess(success[0].value.accessToken), { code: "SESSION_REVOKED" });
    });

    await t.test("logout revokes access/refresh and disconnects all tabs of that session only", async () => {
      const pair = await createSession(userId);
      const other = await createSession(userId);
      const [first, second, unrelated] = await Promise.all([socket(pair), socket(pair), socket(other)]);
      const closed = Promise.all([receive(first, "disconnect"), receive(second, "disconnect")]);
      const result = await request("/auth/logout", pair);
      assert.equal(result.status, 200);
      await closed;
      assert.equal(unrelated.connected, true);
      assert.equal((await request("/auth/me", pair, { method: "GET" })).data.code, "SESSION_REVOKED");
      assert.equal((await request("/auth/refresh", pair)).status, 401);
      assert.equal((await request("/auth/me", other, { method: "GET" })).status, 200);
      assert.ok(result.headers.every(h => h.includes("Expires=Thu, 01 Jan 1970")));
    });

    await t.test("an already-connected socket expires, then reconnects after refresh", async () => {
      process.env.ACCESS_TOKEN_TTL_SECONDS = "2";
      const pair = await createSession(userId);
      process.env.ACCESS_TOKEN_TTL_SECONDS = "900";
      const client = await socket(pair);
      const expired = receive(client, "auth:expired");
      const closed = receive(client, "disconnect");
      assert.equal((await expired).code, "ACCESS_EXPIRED");
      await closed;
      const fresh = await request("/auth/refresh", pair);
      assert.equal(fresh.status, 200);
      assert.equal((await socket(fresh.pair)).connected, true);
    });

    await t.test("expired sessions cannot refresh even before TTL cleanup", async () => {
      const pair = await createSession(userId);
      const decoded = verifyToken(pair.accessToken);
      await AuthSession.updateOne({ _id: decoded.sid }, { $set: { expiresAt: new Date(0) } });
      assert.equal((await request("/auth/refresh", pair)).status, 401);
      assert.equal((await request("/auth/me", pair, { method: "GET" })).status, 401);
    });
  } finally {
    for (const client of clients) client.disconnect();
    await new Promise(resolve => io.close(resolve));
    setIO(null);
    try { if (mongoose.connection.name === dbName && dbName.startsWith("chat_test_")) await mongoose.connection.dropDatabase(); }
    finally { await mongoose.disconnect(); }
  }
});
