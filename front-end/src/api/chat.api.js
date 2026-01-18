import { api } from "./axios.js";

export const ChatAPI = {
  // User + conversation + messages
  listUsers: () => api.get("/users"),
  createOrGetDirect: (otherUserId) =>
    api.post("/conversations/direct", { otherUserId }),
  listConversations: () => api.get("/conversations"),
  deleteConversation: (conversationId) =>
    api.delete(`/conversations/${conversationId}`),
  getMessages(conversationId, params = {}) {
    return api.get("/messages", {
      params: { conversationId, ...params },
    });
  },

  // Send message (text and/or attachments)
  sendMessage: (conversationId, payloadOrText) => {
    const body =
      typeof payloadOrText === "string"
        ? { conversationId, text: payloadOrText }
        : { conversationId, ...(payloadOrText || {}) };
    return api.post("/messages", body);
  },

  // Upload single file (multipart/form-data, field: "file")
  uploadSingle: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post("/upload/single", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  // Delete uploaded file on Cloudinary (your backend route)
  // NOTE: đang dùng POST /upload/delete (vì mày nói xoá được rồi)
  deleteUploaded: ({ publicId, resourceType }) =>
    api.delete("/upload/delete", {
      data: { publicId, resourceType },
    }),

  // Friends / Notifications (giữ nguyên nếu mày đang dùng)
  listFriends: () => api.get("/friends"),
  listIncomingRequests: (status = "pending") =>
    api.get("/friends/requests/incoming", { params: { status } }),
  sendFriendRequest: (toUserId) => api.post("/friends/requests", { toUserId }),
  acceptRequest: (requestId) =>
    api.post(`/friends/requests/${requestId}/accept`),
  rejectRequest: (requestId) =>
    api.post(`/friends/requests/${requestId}/reject`),

  listNotifications: () => api.get("/notifications"),
  markAllNotificationsRead: () => api.post("/notifications/read-all"),

  searchUserByEmail: (email) => api.get("/users/search", { params: { email } }),

  editMessage: (messageId, body) => api.patch(`/messages/${messageId}`, body),
  recallMessage: (messageId) => api.post(`/messages/${messageId}/recall`),
  togglePinMessage: (messageId) => api.post(`/messages/${messageId}/pin`),

  // function crateGroup
  createGroup: ({ name, memberIds }) =>
    api.post("/conversations/group", { name, memberIds }),

  leaveGroup: (conversationId) =>
    api.post(`/conversations/${conversationId}/leave`),

  addGroupMember: (conversationId, userId) =>
    api.post(`/conversations/${conversationId}/members`, { userId }),
};
