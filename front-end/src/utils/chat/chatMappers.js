export function mapConversationsToChats({
  convos,
  meId,
  onlineIdsSet,
  avatarFromName,
  formatTimeOrDate,
}) {
  const getTs = (c) => {
    const x =
      c?.lastMessage?.createdAt ?? c?.lastMessageAt ?? c?.createdAt ?? 0;
    const t = new Date(x).getTime();
    return Number.isFinite(t) ? t : 0;
  };

  const list = Array.isArray(convos) ? [...convos] : [];
  list.sort((a, b) => {
    const dt = getTs(b) - getTs(a);
    if (dt !== 0) return dt;
    return String(b?.id || "").localeCompare(String(a?.id || ""));
  });

  return list.map((c) => {
    const other =
      c.members?.find((m) => String(m.id) !== String(meId)) ??
      c.members?.[0] ??
      null;

    const name = other?.name ?? "Conversation";
    const lastText = c.lastMessage?.text ?? "";
    const lastTs = c.lastMessage?.createdAt ?? c.lastMessageAt ?? c.createdAt;

    return {
      id: String(c.id),
      name,
      avatar: other.avatarUrl || avatarFromName(other.name),
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
      avatar: u.avatarUrl || avatarFromName(u.name),
      email: u.email,
      role: u.role,
      status: onlineIdsSet.has(String(u.id)) ? "online" : "offline",
    }));
}
