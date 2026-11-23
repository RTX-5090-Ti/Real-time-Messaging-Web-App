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
- 15-minute access JWT and rotating refresh token in **HTTP-only cookies**
- Server-side sessions, refresh reuse detection and logout revocation
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

- Client login → Server returns **access and refresh cookies**
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

### Access tokens and refresh sessions

Access JWTs expire after 15 minutes (`ACCESS_TOKEN_TTL_SECONDS=900`, maximum 900).
Refresh tokens are random secrets stored in an HttpOnly cookie scoped to `/auth`;
only their SHA-256 hashes are stored in MongoDB. Each login session lasts a fixed
7 days. `POST /auth/refresh` rotates the refresh token without extending that
deadline. Reusing a consumed refresh token revokes that session, including its
access tokens and connected sockets. Logout revokes the current browser session
and clears both cookies; separate device sessions remain signed in.

Axios retries an expired-access request once after refresh. Socket.IO disconnects
at access expiry and reconnects with refreshed cookies. Concurrent refreshes share
one promise per tab; Web Locks serialize refresh/logout across tabs on supported
browsers (HTTPS or localhost). Without Web Locks, only same-tab coordination is
available; concurrent refreshes across tabs can trigger reuse protection and
require login again. Tokens are never stored in localStorage.

Set `CLIENT_ORIGIN` to the exact frontend origin. Authentication POSTs and
cookie-authenticated mutations require that Origin header; API tools must send
it too. Production cookies use `Secure` and `SameSite=None`, so deploy over HTTPS.
Session/token collections and indexes initialize on backend startup. MongoDB
transactions require a replica set, including for login and refresh.

Restart the backend and sign in again after this update: old JWTs lack the new
session claims. Development still uses `npm run dev` in each project directory.
`JWT_EXPIRES_IN` is replaced by `ACCESS_TOKEN_TTL_SECONDS`; `REFRESH_COOKIE_NAME`
defaults to `refresh_token`. The existing `COOKIE_NAME` remains the access cookie.

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


## Verification (checklist 5)

Install dependencies in both `back-end` and `front-end` with `npm ci`.

| Directory | Command | Coverage |
| --- | --- | --- |
| `back-end` | `npm test` | Offline validation, state merge, typing, visibility and reconnect helper tests; DB suites are skipped unless `CHAT_TEST_DB=1`. |
| `back-end` | `npm run test:integration` | All backend tests, including actual HTTP/Socket.IO connections and isolated MongoDB fixtures. Requires `MONGO_URI` in `.env`. |
| `front-end` | `npm test` | React component and hook tests in jsdom. |
| `front-end` | `npm run lint` | ESLint checks. |
| `front-end` | `npm run build` | Production build. |

`back-end/test/transport.test.js` starts its own HTTP/Socket.IO server bound to
127.0.0.1 on an ephemeral port. Test accounts are created through register/login;
real cookies authenticate subsequent HTTP requests and socket handshakes.
It covers unauthorized access, concurrent direct creation, multiple groups,
lost ACK and retry, REST send/edit/pin/recall delivery, reconnect across 205 missed
messages, unread/read receipts, multi-tab typing/presence and group-room eviction.
It never sends messages to application users or calls Cloudinary to delete files.

Each DB suite creates its own `chat_test_*` database and drops only that database
in teardown. The configured MongoDB account must be able to create/drop test
databases and support transactions. Never point these tests at a service whose
policies prohibit temporary test databases.

`front-end/test/chat.test.jsx` mounts the actual chat page after a mocked login,
checks ACK-only send confirmation and listener cleanup, exercises delayed history
responses and chat switching, and checks that seen waits for visibility/focus.
The DOM suite mocks HTTP/socket boundaries and browser layout; it does not replace
manual testing in real browsers or a visual/mobile layout check.

`back-end/test/auth.test.js` verifies cookie flags, token expiry/rotation, reuse,
origin rejection, concurrent refresh, session revocation and socket expiry against
real HTTP/Socket.IO and an isolated database. Frontend session tests cover retry
limits, shared refresh, cross-tab locking, logout races and socket recovery.
