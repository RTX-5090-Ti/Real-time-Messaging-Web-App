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
- Owner/Admin permissions
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
- Auto retry when reconnect / back online

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
