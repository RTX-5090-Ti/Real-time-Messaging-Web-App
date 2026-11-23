import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { Server } from "socket.io";
import { io as clientIO } from "socket.io-client";
import app from "../src/app.js";
import { initSocket } from "../src/sockets/index.js";
import { setIO } from "../src/sockets/io.js";
import Conversation from "../src/models/Conversation.js";
import Message from "../src/models/Message.js";
import Upload from "../src/models/Upload.js";
import { fetchHistoryWindow } from "../../front-end/src/utils/chat/historySync.js";
import { mapMessage, mergeMessages } from "../../front-end/src/utils/chat/messageState.js";

async function until(check, label, timeout = 5000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = check();
    if (value) return value;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.fail(`Timed out: ${label}`);
}
const ack = (socket, event, payload) => socket.timeout(5000).emitWithAck(event, payload);

test("HTTP and Socket.IO integration", { skip: process.env.CHAT_TEST_DB !== "1", timeout: 120000 }, async t => {
  const dbName = `chat_test_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
  const clients = [];
  const server = http.createServer(app);
  const io = new Server(server);
  process.env.JWT_SECRET = randomUUID(); // Test process only; never use real session credentials.
  setIO(io);
  initSocket(io);
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName, autoIndex: false, serverSelectionTimeoutMS: 10000 });
    await Promise.all(Object.values(mongoose.models).map(model => model.createIndexes()));
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
    const base = `http://127.0.0.1:${server.address().port}`;
    async function request(method, path, cookie, body) {
      const result = await fetch(`${base}${path}`, { method,
        headers: { Origin: process.env.CLIENT_ORIGIN || "http://localhost:5173", ...(cookie ? { Cookie: cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000),
      });
      return { status: result.status, data: await result.json(),
        cookie: result.headers.getSetCookie().map(c => c.split(";")[0]).join("; ") };
    }
    async function account(name) {
      const credentials = { name, email: `${name}@example.test`, password: "test-password-123" };
      const registered = await request("POST", "/auth/register", null, credentials);
      assert.equal(registered.status, 201);
      const login = await request("POST", "/auth/login", null, credentials);
      assert.equal(login.status, 200);
      assert.ok(login.cookie);
      return { id: login.data.user.id, cookie: login.cookie };
    }
    async function connect(cookie, expectedError = false) {
      const socket = clientIO(base, { transports: ["websocket"], extraHeaders: cookie ? { Cookie: cookie } : {},
        reconnection: false, autoConnect: false });
      clients.push(socket);
      const log = [];
      socket.onAny((event, payload) => log.push({ event, payload }));
      socket.testLog = log;
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Socket handshake timed out")), 5000);
        socket.once("connect", () => { clearTimeout(timer); expectedError ? reject(new Error("Unauthorized socket connected")) : resolve(); });
        socket.once("connect_error", error => { clearTimeout(timer); expectedError ? resolve() : reject(error); });
        socket.connect();
      });
      return socket;
    }
    const eventAfter = (socket, offset, event, predicate = () => true) =>
      until(() => socket.testLog.slice(offset).find(e => e.event === event && predicate(e.payload))?.payload, event);

    const a = await account("alpha");
    const b = await account("bravo");
    const c = await account("charlie");
    const outsider = await account("outsider");
    let a1 = await connect(a.cookie);
    let b1 = await connect(b.cookie);
    const b2 = await connect(b.cookie);
    const stranger = await connect(outsider.cookie);
    let cid;

    await t.test("real auth rejects missing/invalid cookies on HTTP and socket", async () => {
      assert.equal((await request("GET", "/auth/me")).status, 401);
      assert.equal((await request("GET", "/auth/me", a.cookie)).data.user.id, a.id);
      const invalid = `${process.env.COOKIE_NAME || "access_token"}=invalid`;
      assert.equal((await request("GET", "/messages", invalid)).status, 401);
      await connect(null, true);
      await connect(invalid, true);
    });

    await t.test("concurrent direct creation and multiple groups work via HTTP", async () => {
      const direct = await Promise.all(Array.from({ length: 5 }, () => request("POST", "/conversations/direct", a.cookie, { otherUserId: b.id })));
      assert.ok(direct.every(r => r.status === 201));
      assert.equal(new Set(direct.map(r => r.data.conversation.id)).size, 1);
      const groups = await Promise.all(["one", "two"].map(name => request("POST", "/conversations/group", a.cookie, { name, memberIds: [b.id, c.id] })));
      assert.ok(groups.every(r => r.status === 201));
      assert.notEqual(groups[0].data.conversation.id, groups[1].data.conversation.id);
      cid = groups[0].data.conversation.id;
      for (const socket of [a1, b1, b2]) assert.equal((await ack(socket, "conversation:join", cid)).ok, true);
    });

    await t.test("outsider cannot join, read, send, mutate, manage group or delete others' uploads", async () => {
      assert.equal((await ack(stranger, "conversation:join", cid)).error, "FORBIDDEN");
      assert.equal((await request("GET", `/messages?conversationId=${cid}`, outsider.cookie)).status, 403);
      const body = { conversationId: cid, clientId: "forbidden", text: "not allowed" };
      assert.equal((await ack(stranger, "message:send", body)).error, "FORBIDDEN");
      assert.equal((await request("POST", "/messages", outsider.cookie, body)).status, 403);
      const sent = await ack(a1, "message:send", { ...body, clientId: "permission-fixture", text: "allowed" });
      assert.equal(sent.ok, true);
      for (const action of ["edit", "recall", "pin", "react"]) {
        const denied = await ack(stranger, `message:${action}`, { conversationId: cid, messageId: sent.id, text: "bad", emoji: "👍" });
        assert.equal(denied.error, "FORBIDDEN");
      }
      assert.equal((await ack(stranger, "conversation:read", { conversationId: cid, messageId: sent.id })).error, "FORBIDDEN");
      assert.equal((await request("POST", `/conversations/${cid}/members`, outsider.cookie, { userId: outsider.id })).status, 403);
      assert.equal((await request("DELETE", `/conversations/${cid}/members/${c.id}`, b.cookie)).status, 403);
      await Upload.create({ ownerId: a.id, publicId: "transport-owned-file", resourceType: "raw", url: "https://example.test/file" });
      assert.equal((await request("DELETE", "/upload/delete", outsider.cookie, { publicId: "transport-owned-file", resourceType: "raw" })).status, 403);
      assert.equal(await Upload.countDocuments({ publicId: "transport-owned-file" }), 1);
    });

    await t.test("lost acknowledgement followed by reconnect/retry produces one message", async () => {
      const payload = { conversationId: cid, clientId: "lost-ack", text: "send once" };
      const offset = b1.testLog.length;
      // Deliberately do not receive the ACK, then retry on a new connection.
      a1.emit("message:send", payload);
      const original = await eventAfter(b1, offset, "message:new", m => m.clientId === payload.clientId);
      a1.disconnect();
      a1 = await connect(a.cookie);
      const retried = await ack(a1, "message:send", payload);
      assert.equal(retried.ok, true);
      assert.equal(retried.message.id, original.id);
      assert.equal(await Message.countDocuments({ conversationId: cid, clientId: payload.clientId }), 1);
      const restRetry = await request("POST", "/messages", a.cookie, payload);
      assert.equal(restRetry.data.message.id, original.id);
    });

    await t.test("REST fallback emits send/edit/pin/recall to the recipient's real socket", async () => {
      let offset = b1.testLog.length;
      a1.disconnect();
      const result = await request("POST", "/messages", a.cookie, { conversationId: cid, clientId: "rest-fallback", text: "HTTP send" });
      assert.equal(result.status, 201);
      const messageId = result.data.message.id;
      assert.equal((await eventAfter(b1, offset, "message:new", m => m.id === messageId)).text, "HTTP send");
      for (const [method, path, body, event] of [
        ["PATCH", `/messages/${messageId}`, { text: "edited over HTTP" }, "message:edited"],
        ["POST", `/messages/${messageId}/pin`, undefined, "message:pinned"],
        ["POST", `/messages/${messageId}/recall`, undefined, "message:recalled"],
      ]) {
        offset = b1.testLog.length;
        assert.equal((await request(method, path, a.cookie, body)).status, 200);
        assert.equal((await eventAfter(b1, offset, event, m => m.id === messageId)).id, messageId);
      }
      a1 = await connect(a.cookie);
      await ack(a1, "conversation:join", cid);
    });

    await t.test("reconnect restores more than one page and unread clears only on explicit read", async () => {
      const group = await Conversation.create({ type: "group", members: [a.id, b.id], participants: [{ userId: a.id }, { userId: b.id }] });
      const gcid = String(group._id);
      const first = await Message.create({ conversationId: gcid, senderId: a.id, text: "cached", createdAt: new Date("2020-01-01") });
      await ack(b1, "conversation:read", { conversationId: gcid, messageId: String(first._id) });
      b1.disconnect();
      await Message.insertMany(Array.from({ length: 205 }, (_, i) => ({ conversationId: gcid, senderId: a.id, text: `missed-${i}`, createdAt: new Date(Date.UTC(2021, 0, 1, 0, 0, i)) })));
      b1 = await connect(b.cookie);
      assert.equal((await ack(b1, "conversation:join", gcid)).ok, true);
      let summaries = await request("GET", "/conversations", b.cookie);
      assert.equal(summaries.data.conversations.find(g => g.id === gcid).unread, 205);
      let pages = 0;
      const history = await fetchHistoryWindow(async params => {
        pages++;
        const result = await request("GET", `/messages?${new URLSearchParams({ conversationId: gcid, ...params })}`, b.cookie);
        assert.equal(result.status, 200);
        return result.data;
      }, { nextBefore: first.createdAt.toISOString(), nextBeforeId: String(first._id) });
      assert.equal(pages, 3);
      const merged = mergeMessages([], history.messages.map(m => mapMessage(m, b.id)));
      assert.equal(merged.length, 206);
      assert.equal(new Set(merged.map(m => m.id)).size, 206);
      const last = merged.at(-1);
      const offset = b2.testLog.length;
      assert.equal((await ack(b1, "conversation:read", { conversationId: gcid, messageId: last.id, at: "2099-01-01" })).ok, true);
      assert.equal((await eventAfter(b2, offset, "conversation:read", p => p.conversationId === gcid)).at, last.createdAt);
      summaries = await request("GET", "/conversations", b.cookie);
      assert.equal(summaries.data.conversations.find(g => g.id === gcid).unread, 0);
      await ack(b1, "conversation:join", cid);
    });

    await t.test("typing and online status survive closing one tab; last tab goes offline", async () => {
      await ack(a1, "conversation:join", cid);
      let offset = a1.testLog.length;
      await ack(b1, "typing:start", { conversationId: cid });
      await ack(b2, "typing:start", { conversationId: cid });
      await eventAfter(a1, offset, "typing:update", p => p.userId === b.id && p.typing);
      offset = a1.testLog.length;
      const firstSocketId = b1.id;
      b1.disconnect();
      await until(() => !io.sockets.sockets.has(firstSocketId), "first tab disconnect");
      await ack(a1, "presence:sync", undefined);
      assert.ok(!a1.testLog.slice(offset).some(e => e.event === "typing:update" && e.payload.userId === b.id && !e.payload.typing));
      const presence = a1.testLog.filter(e => e.event === "presence:state").at(-1).payload;
      assert.ok(presence.onlineUserIds.includes(b.id));
      offset = a1.testLog.length;
      b2.disconnect();
      await eventAfter(a1, offset, "typing:update", p => p.userId === b.id && !p.typing);
      await eventAfter(a1, offset, "presence:update", p => p.userId === b.id && !p.online);
      b1 = await connect(b.cookie);
    });

    await t.test("kick removes every tab from the room and denies rejoin", async () => {
      const extra = await connect(b.cookie);
      for (const socket of [b1, extra]) await ack(socket, "conversation:join", cid);
      assert.equal((await request("DELETE", `/conversations/${cid}/members/${b.id}`, a.cookie)).status, 200);
      for (const socket of [b1, extra]) {
        assert.ok(!io.sockets.sockets.get(socket.id).rooms.has(cid));
        assert.equal((await ack(socket, "conversation:join", cid)).error, "FORBIDDEN");
        assert.equal((await ack(socket, "typing:start", { conversationId: cid })).error, "FORBIDDEN");
      }
    });
  } finally {
    for (const client of clients) client.disconnect();
    await new Promise(resolve => io.close(resolve));
    setIO(null);
    try {
      if (mongoose.connection.name === dbName && dbName.startsWith("chat_test_")) await mongoose.connection.dropDatabase();
    } finally { await mongoose.disconnect(); }
  }
});
