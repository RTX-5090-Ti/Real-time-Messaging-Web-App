# Real-time Messaging Chat App (MERN + Socket.io)

A **Messenger-like real-time chat application** built with **MERN Stack** and **Socket.io**, featuring typing indicators, seen status, reactions, replies, pin/search, media uploads, GIFs, and group chat.

---

## Highlights (What makes this project stand out)

- **Real-time messaging** with Socket.io (rooms + ACK)
- **JWT Cookie Authentication** (HTTP-only cookie)
- **Optimistic UI** + message delivery status (**sending → retry → sent**)
- **Messenger-style UX**: typing, seen-by avatar, reactions, reply & jump
- **Group chat** with system messages and member management
- **Media upload** (Cloudinary) + **GIF integration** (GIPHY URL)
- **Search & highlight** messages (next/prev navigation)

---

## 🎬 Demo

### Demo Video

-https://www.youtube.com/watch?v=CFdMKMewVS8&t=8s

---

## ✅ Features

### Authentication & Security

- Register / Login / Logout
- JWT stored in **HTTP-only cookie**
- Protected routes (Require Auth)

### 1-1 Chat (Direct)

- Send messages in real-time
- Typing indicator (like Messenger)
- Seen status (**seen by avatar**)
- Conversation auto-sorting by latest activity

### Group Chat

- Create group conversation
- Add members / Leave group
- Owner/Admin permissions and transactional membership updates
- System messages:
  - `A added B to the group`
  - `A left the group`
- Group typing indicator

### Messaging Experience (Core UX)

- **Reaction**: one emoji per user, toggle to remove
- **Reply**: quote message + click to jump to original
- **Edit message**
- **Recall message**
- **Pin message** + list pinned messages
- **Search messages** + highlight + next/prev navigation

### Media & Attachments

- Upload image/file via **Cloudinary**
- Send **GIF** via **GIPHY** (URL-only)

### Reliability

- Message status: `sending → retry → sent`
- Manual retry for failed sends; automatic history synchronization on reconnect

---

## Tech Stack

### Frontend

- React (Vite)
- TailwindCSS
- Axios (withCredentials)
- Socket.io-client

### Backend

- Node.js + Express
- MongoDB + Mongoose
- Socket.io
- JWT + cookie-parser
- express-validator
- Multer + Cloudinary

### Services

- MongoDB Atlas (database)
- Cloudinary (media storage)
- GIPHY (GIF search/send)

---

## System Architecture (High level)

- Client login → Server returns **JWT cookie**
- REST API for:
  - conversations
  - messages
  - uploads
  - friends/notifications
- Socket.io for real-time:
  - send/receive messages
  - typing
  - seen/read updates
  - reactions/reply/edit/recall/pin
- Socket uses **rooms**
  - `user:<userId>` for personal notifications/events
  - `conversation:<conversationId>` for chat room

---

## 📁 Project Structure


## Reliability and security setup

After pulling these changes, run `npm run migrate:chat` from `back-end` before
restarting the API. This installs the partial unique direct-conversation index
and the message idempotency index, and removes only the known old sparse direct
index. It does not delete conversations or messages.

Both HTTP and Socket.IO message sends require a stable `clientId` (1?128 letters,
numbers, underscores or hyphens). Reuse it when retrying the same send. The ACK
includes the saved message. History pagination uses both `before` and `beforeId`.
Reconnect re-reads the open conversation through its oldest cached message and
refreshes the conversation list; other conversations reconcile when opened.

Uploads now record ownership. Legacy assets without ownership metadata cannot
be deleted through the upload endpoint; ownership must be established before
backfilling those records. No ownership is inferred from a URL or caller input.

Limits per server: authentication 20 attempts/15 minutes/IP, message operations
60/minute/user, typing 120/minute/user, uploads 30/minute/user. These in-memory
limits must use a shared store before deploying multiple API instances.
Messages allow 10,000 characters and up to 10 attachments with HTTPS URLs.

Run `npm test` in `back-end` for offline tests. To also run DB integration tests
in PowerShell: `$env:CHAT_TEST_DB='1'; npm test`. These tests use a uniquely named
temporary database with the configured MongoDB credentials, then drop only that
test database. They never insert test messages into the application's database.


## Read receipts, typing and concurrent updates

Read receipts are sent only for a saved message visible in a focused chat pane.
Opening a chat or receiving a message in a background tab does not mark it read.
The server derives the read time from the referenced message and advances the
watermark atomically. Join/reconnect also restores the saved read receipts.

Typing sends a heartbeat while the user continues entering text. Each socket
has its own expiry; closing one tab does not stop another tab's typing. Leaving
or being removed from a group removes every socket of that user from its room.

Group membership, ownership/admin transfer, system messages and kick notifications
commit in a MongoDB transaction. MongoDB must be a replica set (Atlas supports
this); a standalone local MongoDB server must be configured as a replica set.
Message mutations use optimistic concurrency and retry conflicting writes.
Clients merge full message revisions so delayed events cannot undo newer edits.

Conversation summaries use one aggregation plus one user lookup, rather than
separate message/count queries per conversation. Sorting uses last message
activity (creation time for empty chats), never read/profile update time.

Socket handlers are split into conversation, message and typing modules. Group,
read receipt, message and conversation-list logic live in shared services.
