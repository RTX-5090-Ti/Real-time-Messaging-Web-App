import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { validateSend } from "../src/validations/chatPayload.js";
import { createLimiter } from "../src/middlewares/rateLimit.js";
import { mergeMessages } from "../../front-end/src/utils/chat/messageState.js";
import { sendChatMessage, mutateChatMessage } from "../src/services/message.service.js";
import { getMessages, sendMessage } from "../src/controllers/message.controller.js";
import { deleteUploadedFile } from "../src/controllers/upload.controller.js";
import { cloudinary } from "../src/config/cloudinary.js";
import { setIO } from "../src/sockets/io.js";
import Conversation from "../src/models/Conversation.js";
import Message from "../src/models/Message.js";
import User from "../src/models/User.js";
import Upload from "../src/models/Upload.js";
import AuthSession from "../src/models/AuthSession.js";
import { initSocket } from "../src/sockets/index.js";
import { fetchHistoryWindow } from "../../front-end/src/utils/chat/historySync.js";
import { visibleReadCandidate } from "../../front-end/src/utils/chat/readVisibility.js";
import { createTypingTracker } from "../src/sockets/typing.js";
import { markConversationRead } from "../src/services/read.service.js";
import { listConversationSummaries } from "../src/services/conversationList.service.js";
import { changeGroup } from "../src/services/group.service.js";

const cid = "a".repeat(24);
const valid = { conversationId: cid, clientId: "retry-1", text: "hello" };

test("seen requires visible focused chat and a message inside its viewport", () => {
  const root = { width: 100, height: 100, top: 0, bottom: 100, left: 0, right: 100 };
  const entries = [
    { id: "first", rect: { ...root, bottom: 50 } },
    { id: "below", rect: { ...root, top: 110, bottom: 150 } },
    { id: "tmp:pending", rect: { ...root, bottom: 70 } },
  ];
  assert.equal(visibleReadCandidate(root, entries, true, true), "first");
  assert.equal(visibleReadCandidate(root, entries, false, true), null);
  assert.equal(visibleReadCandidate(root, entries, true, false), null);
  assert.equal(visibleReadCandidate({ ...root, width: 0 }, entries, true, true), null);
});

test("typing TTL is refreshed and stopping one tab preserves the other tab", async () => {
  const updates = [];
  const tracker = createTypingTracker({ to: () => ({ emit: (_, p) => updates.push(p) }) }, 80);
  const first = { id: "tab1", user: { id: "user", name: "A" } };
  const second = { id: "tab2", user: first.user };
  tracker.start(cid, first);
  tracker.start(cid, second);
  tracker.disconnect(first);
  assert.equal(updates.at(-1).typing, true);
  await new Promise(resolve => setTimeout(resolve, 45));
  tracker.start(cid, second);
  await new Promise(resolve => setTimeout(resolve, 45));
  assert.equal(updates.at(-1).typing, true);
  await new Promise(resolve => setTimeout(resolve, 55));
  assert.equal(updates.at(-1).typing, false);
});

test("message payload rejects invalid types, oversized content and unsafe URLs", () => {
  assert.equal(validateSend(valid).text, "hello");
  for (const input of [null, [], { ...valid, clientId: undefined }, { ...valid, text: {} },
    { ...valid, text: "x".repeat(10001) }, { ...valid, attachments: Array(11).fill({}) },
    { ...valid, attachments: [{ kind: "file", url: "javascript:alert(1)" }] },
    { ...valid, attachments: [{ kind: "gif", provider: "giphy", gifId: "1", url: "https://giphy.com.evil.test/a" }] }]) {
    assert.throws(() => validateSend(input));
  }
});

test("rate limiter shares a user's bucket but isolates other users", () => {
  const limit = createLimiter(2, 1000);
  limit("a"); limit("a");
  assert.throws(() => limit("a"), { status: 429 });
  assert.doesNotThrow(() => limit("b"));
});

test("history merge preserves new messages, pending sends and newer edits", () => {
  const newer = { id: "1", createdAt: "2026-01-01", updatedAt: "2026-01-03", text: "edited" };
  const pending = { id: "tmp:k", clientId: "k", from: "me", status: "sending", createdAt: "2026-01-04" };
  const result = mergeMessages([newer, pending, { id: "2", createdAt: "2026-01-02" }],
    [{ ...newer, text: "old", updatedAt: "2026-01-02" }]);
  assert.equal(result.length, 3);
  assert.equal(result[0].text, "edited");
  assert.equal(result[2].status, "sending");
  const ack = { id: "3", clientId: "k", from: "me", createdAt: "2026-01-04" };
  const confirmed = mergeMessages(result, [ack]);
  assert.equal(confirmed.length, 3);
  assert.ok(!confirmed.some(m => m.id === "tmp:k"));
  assert.equal(mergeMessages(confirmed, [ack]).length, 3);
  assert.ok(mergeMessages([pending], [{ ...ack, from: "other" }]).some(m => m.id === "tmp:k"));
});

test("malformed socket payload returns an error ACK rather than throwing", async t => {
  t.mock.method(AuthSession, "exists", async () => true);
  let connect;
  const handlers = {};
  const io = { use() {}, on(event, fn) { connect = fn; }, emit() {} };
  initSocket(io);
  connect({ id: "socket-test", auth: { sessionId: cid, expiresAt: Date.now() + 900000 }, user: { id: cid, name: "test" }, join() {}, emit() {},
    broadcast: { emit() {} }, on(event, fn) { handlers[event] = fn; } });
  let reply;
  await handlers["message:send"](null, value => { reply = value; });
  assert.equal(reply.error, "INVALID_PAYLOAD");
  handlers.disconnect();
});

function response() {
  return { code: 200, body: null, status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; } };
}

test("reconnect loads every missing page and ignores an obsolete response", async () => {
  const at = "2026-01-01T00:00:00.000Z";
  const pages = [
    { messages: [{ id: "9" }, { id: "8" }], hasMore: true, nextBefore: at, nextBeforeId: "8" },
    { messages: [{ id: "7" }, { id: "6" }], hasMore: true, nextBefore: at, nextBeforeId: "6" },
    { messages: [{ id: "5" }, { id: "4" }], hasMore: true, nextBefore: at, nextBeforeId: "4" },
  ];
  const calls = [];
  const result = await fetchHistoryWindow(async params => {
    calls.push(params);
    return pages[calls.length - 1];
  }, { nextBefore: at, nextBeforeId: "4" });
  assert.equal(result.messages.length, 6);
  assert.equal(calls[1].beforeId, "8");
  assert.equal(calls[2].beforeId, "6");
  const stale = await fetchHistoryWindow(async () => pages[0], null, () => false);
  assert.equal(stale, null);
});

test("database integration in an isolated temporary database", { skip: process.env.CHAT_TEST_DB !== "1" }, async (t) => {
  const dbName = `chat_test_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
  await mongoose.connect(process.env.MONGO_URI, { dbName, autoIndex: false, serverSelectionTimeoutMS: 10000 });
  const events = [];
  const evictions = [];
  setIO({ to(room) { return { emit(event, payload) { events.push({ room, event, payload }); } }; },
    in(room) { return { socketsLeave(cid) { evictions.push({ room, cid }); } }; } });
  try {
    await Promise.all([User, Conversation, Message, Upload].map(m => m.createIndexes()));
    const [a, b, stranger] = await User.create(["a", "b", "stranger"].map(name => ({ name, email: `${name}@test.invalid`, passwordHash: "test-only" })));
    const group = await Conversation.create({ type: "group", members: [a._id, b._id], participants: [{ userId: a._id }, { userId: b._id }] });
    const input = { ...valid, conversationId: String(group._id) };

    await t.test("multiple groups allowed; direct key remains unique", async () => {
      await Conversation.create({ type: "group", members: [a._id, b._id] });
      await Conversation.create({ type: "direct", directKey: "a_b", members: [a._id, b._id] });
      await assert.rejects(Conversation.create({ type: "direct", directKey: "a_b", members: [a._id, b._id] }), { code: 11000 });
    });
    await t.test("simultaneous sends and retry produce one DB message", async () => {
      const results = await Promise.all(Array.from({ length: 5 }, () => sendChatMessage(String(a._id), input)));
      assert.equal(new Set(results.map(m => m.id)).size, 1);
      assert.equal(await Message.countDocuments({ conversationId: group._id }), 1);
      const retry = await sendChatMessage(String(a._id), input);
      assert.equal(retry.id, results[0].id);
    });
    await t.test("REST fallback and mutations emit to recipient rooms", async () => {
      events.length = 0;
      const res = response();
      await sendMessage({ user: { id: String(a._id) }, body: { ...input, clientId: "rest" } }, res);
      assert.ok(events.some(e => e.room === `user:${b._id}` && e.event === "message:new"));
      const messageId = res.body.message.id;
      for (const [action, event] of [["edit", "message:edited"], ["pin", "message:pinned"], ["recall", "message:recalled"]]) {
        await mutateChatMessage(String(a._id), action, { messageId, text: "updated" });
        assert.ok(events.some(e => e.room === `user:${b._id}` && e.event === event));
      }
      await assert.rejects(mutateChatMessage(String(b._id), "edit", { messageId, text: "bad" }), { status: 403 });
      await assert.rejects(sendChatMessage(String(stranger._id), input), { status: 403 });
    });
    await t.test("timestamp ties paginate without omissions", async () => {
      const pageGroup = await Conversation.create({ type: "group", members: [a._id] });
      const at = new Date("2026-01-01T00:00:00Z");
      await Message.insertMany(Array.from({ length: 7 }, () => ({ conversationId: pageGroup._id, senderId: a._id, text: "same time", createdAt: at })));
      const ids = [];
      let cursor = {};
      let hasMore;
      do {
        const res = response();
        await getMessages({ user: { id: String(a._id) }, query: { conversationId: String(pageGroup._id), limit: 2, ...cursor } }, res);
        ids.push(...res.body.messages.map(m => m.id));
        hasMore = res.body.hasMore;
        cursor = { before: res.body.nextBefore.toISOString(), beforeId: String(res.body.nextBeforeId) };
      } while (hasMore);
      assert.equal(ids.length, 7);
      assert.equal(new Set(ids).size, 7);
    });
    await t.test("upload deletion requires ownership", async () => {
      await Upload.create({ ownerId: a._id, publicId: "test-file", resourceType: "raw", url: "https://example.com/file" });
      const destroy = t.mock.method(cloudinary.uploader, "destroy", async () => ({ result: "ok" }));
      const denied = response();
      await deleteUploadedFile({ user: { id: String(b._id) }, body: { publicId: "test-file", resourceType: "raw" } }, denied);
      assert.equal(denied.code, 403);
      assert.equal(destroy.mock.callCount(), 0);
      const allowed = response();
      await deleteUploadedFile({ user: { id: String(a._id) }, body: { publicId: "test-file", resourceType: "raw" } }, allowed);
      assert.equal(allowed.body.ok, true);
      assert.equal(destroy.mock.callCount(), 1);
    });
    await t.test("read watermark is server-derived, monotonic and isolated between users", async () => {
      const [old, recent] = await Message.create([
        { conversationId: group._id, senderId: a._id, text: "old", createdAt: new Date("2025-01-01") },
        { conversationId: group._id, senderId: a._id, text: "recent", createdAt: new Date("2025-01-02") },
      ]);
      await markConversationRead(String(b._id), { conversationId: String(group._id), messageId: String(recent._id), at: "2099-01-01" });
      await Promise.all([
        markConversationRead(String(b._id), { conversationId: String(group._id), messageId: String(old._id) }),
        markConversationRead(String(a._id), { conversationId: String(group._id), messageId: String(old._id) }),
      ]);
      const saved = await Conversation.findById(group._id);
      assert.equal(saved.participants.find(p => p.userId.equals(b._id)).lastReadAt.toISOString(), recent.createdAt.toISOString());
      assert.equal(saved.participants.find(p => p.userId.equals(a._id)).lastReadAt.toISOString(), old.createdAt.toISOString());
      await assert.rejects(markConversationRead(String(stranger._id), { conversationId: String(group._id), messageId: String(old._id) }), { status: 403 });
    });
    await t.test("concurrent reactions survive and same-user toggles serialize", async () => {
      const message = await sendChatMessage(String(a._id), { ...input, clientId: "reaction-test" });
      await Promise.all([a, b].map(user => mutateChatMessage(String(user._id), "react", { messageId: message.id, emoji: "👍" })));
      assert.equal((await Message.findById(message.id)).reactions.length, 2);
      await Promise.all(Array.from({ length: 2 }, () => mutateChatMessage(String(a._id), "react", { messageId: message.id, emoji: "👍" })));
      assert.equal((await Message.findById(message.id)).reactions.length, 2);
    });
    await t.test("summary sorting ignores read/profile updates and unread respects clear time", async () => {
      const old = await Conversation.create({ type: "group", members: [a._id], lastMessageAt: new Date("2020-01-01"), participants: [{ userId: a._id, clearedAt: new Date("2020-01-02") }] });
      await Message.create({ conversationId: old._id, senderId: b._id, text: "hidden", createdAt: new Date("2020-01-01") });
      const summaries = await listConversationSummaries(String(a._id));
      assert.equal(summaries.at(-1).id, String(old._id));
      assert.equal(summaries.at(-1).unread, 0);
      assert.equal(summaries.at(-1).lastMessage, null);
    });
    await t.test("concurrent group additions are unique; removal evicts all user sockets", async () => {
      const g = await Conversation.create({ type: "group", members: [a._id, b._id], createdBy: a._id, admins: [a._id], participants: [{ userId: a._id }, { userId: b._id }] });
      const actor = { id: String(a._id), name: a.name };
      await Promise.all(Array.from({ length: 2 }, () => changeGroup(actor, String(g._id), "add", { userId: String(stranger._id) })));
      const added = await Conversation.findById(g._id);
      assert.equal(added.members.length, 3);
      assert.equal(added.participants.length, 3);
      assert.equal(await Message.countDocuments({ conversationId: g._id, "system.type": "member_added" }), 1);
      await changeGroup(actor, String(g._id), "kick", { userId: String(stranger._id) });
      assert.ok(evictions.some(e => e.room === `user:${stranger._id}` && e.cid === String(g._id)));
      await Promise.all([a, b].map(user => changeGroup({ id: String(user._id), name: user.name }, String(g._id), "leave")));
      const empty = await Conversation.findById(g._id);
      assert.equal(empty.members.length, 0);
      assert.equal(empty.admins.length, 0);
      assert.equal(empty.participants.length, 0);
      assert.equal(empty.createdBy, null);
    });
  } finally {
    setIO(null);
    // Only ever remove the test database created by this invocation.
    try {
      if (mongoose.connection.name === dbName && dbName.startsWith("chat_test_")) await mongoose.connection.dropDatabase();
    } finally { await mongoose.disconnect(); }
  }
});
