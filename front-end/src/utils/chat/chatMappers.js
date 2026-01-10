export function mapConversationsToChats({
  convos,
  meId,
  onlineIdsSet,
  avatarFromName,
  formatTimeOrDate,
}) {
  return (convos || []).map((c) => {
    const other =
      c.members?.find((m) => String(m.id) !== String(meId)) ??
      c.members?.[0] ??
      null;

    const name = other?.name ?? "Conversation";
    const lastText = c.lastMessage?.text ?? "";
    const lastTs =
      c.lastMessage?.createdAt ?? c.lastMessageAt ?? c.updatedAt ?? c.createdAt;

    return {
      id: String(c.id),
      name,
      avatar: avatarFromName(name),
      lastMessage: lastText || "Open to see messages",
      time: formatTimeOrDate(lastTs),
      unread: Number(c.unread ?? 0),
      pinned: false,

      members: c.members?.length ?? 2,
      online: other?.id ? (onlineIdsSet.has(String(other.id)) ? 2 : 1) : 0,

      otherUserId: other?.id ? String(other.id) : null,
      _raw: c,
    };
  });
}

export function mapUsersToFriends({
  users,
  meId,
  onlineIdsSet,
  avatarFromName,
}) {
  return (users || [])
    .filter((u) => String(u.id) !== String(meId))
    .map((u) => ({
      id: String(u.id),
      name: u.name,
      avatar: avatarFromName(u.name),
      email: u.email,
      role: u.role,
      status: onlineIdsSet.has(String(u.id)) ? "online" : "offline",
    }));
}
