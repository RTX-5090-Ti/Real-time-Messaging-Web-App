import { avatarFromName, formatTime } from "../chatUi.js";
import { formatSystemText } from "../systemText.js";

export function mapMessage(m, meId) {
  const sender = m.sender || m.senderId || null;
  const senderId = sender?.id ? String(sender.id) : null;
  const senderName = sender?.name ?? "User";
  const senderAvatarUrl = sender?.avatarUrl || null;
  const createdAt = m.createdAt ?? new Date().toISOString();
  const attachments = Array.isArray(m.attachments) ? m.attachments : [];

  const kind = m.kind || "user";

  if (kind === "system") {
    const createdAt = m.createdAt ?? new Date().toISOString();
    return {
      id: String(m.id ?? m._id),
      clientId: m.clientId,
      updatedAt: m.updatedAt,
    revision: m.__v,
      kind: "system",
      from: "system",
      system: m.system || null,
      text: formatSystemText(m.system, m.text ?? "", meId),
      createdAt,
      time: formatTime(createdAt),
    };
  }

  return {
    id: String(m.id ?? m._id),
    clientId: m.clientId,
    updatedAt: m.updatedAt,
    revision: m.__v,
    from: senderId === String(meId) ? "me" : "other",
    senderId,
    name: senderName,
    avatarUrl: senderAvatarUrl,
    avatar: senderAvatarUrl || avatarFromName(senderName),
    text: m.text ?? "",
    attachments,
    time: formatTime(createdAt),
    createdAt,
    replyTo: m.replyTo
      ? {
          id: String(m.replyTo.id ?? m.replyTo._id),
          text: m.replyTo.text ?? "",
          attachments: Array.isArray(m.replyTo.attachments)
            ? m.replyTo.attachments
            : [],
          sender: m.replyTo.sender || m.replyTo.senderId || null,
        }
      : null,

    reactions: Array.isArray(m.reactions)
      ? m.reactions.map((r) => ({
          userId: String(r.userId?.id ?? r.userId?._id ?? r.userId),
          emoji: r.emoji,
        }))
      : [],
    pinned: !!m.pinned,
    pinnedAt: m.pinnedAt ?? null,
    pinnedBy: m.pinnedBy ?? null,

    editedAt: m.editedAt ?? null,
    isRecalled: !!m.isRecalled,
    recalledAt: m.recalledAt ?? null,
    recalledBy: m.recalledBy ?? null,
  };
}


// A late history response must not undo a newer socket update.
export function mergeMessages(current, incoming) {
  const byId = new Map(current.map(m => [String(m.id), m]));
  for (const message of incoming) {
    const old = byId.get(String(message.id));
    if (old && (Number(old.revision || 0) > Number(message.revision || 0) ||
      (Number(old.revision || 0) === Number(message.revision || 0) && new Date(old.updatedAt || 0) > new Date(message.updatedAt || 0)))) continue;
    if (message.clientId && message.from === "me" && !String(message.id).startsWith("tmp:")) {
      for (const [id, item] of byId) {
        if (item.from === "me" && item.clientId === message.clientId && id.startsWith("tmp:")) byId.delete(id);
      }
    }
    byId.set(String(message.id), { ...old, ...message, status: message.status,
      __retryPayload: message.__retryPayload, errorMsg: message.errorMsg || "" });
  }
  return [...byId.values()].sort((a, b) =>
    new Date(a.createdAt) - new Date(b.createdAt) || String(a.id).localeCompare(String(b.id)));
}
