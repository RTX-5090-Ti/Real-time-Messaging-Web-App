// ✅ Map conversation list (direct + group) -> Sidebar UI
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
    const members = Array.isArray(c?.members) ? c.members : [];

    // ✅ detect group
    const isGroup =
      String(c?.type || "").toLowerCase() === "group" ||
      c?.isGroup === true ||
      members.length > 2;

    const other =
      members.find((m) => String(m.id) !== String(meId)) ?? members[0] ?? null;

    // ✅ group name
    const groupName =
      c?.name ||
      c?.title ||
      members
        .filter((m) => String(m.id) !== String(meId))
        .map((m) => m?.name)
        .filter(Boolean)
        .slice(0, 3)
        .join(", ") ||
      "Group chat";

    const name = isGroup ? groupName : other?.name ?? "Conversation";

    const avatar = isGroup
      ? c?.avatarUrl || avatarFromName(name)
      : other?.avatarUrl || avatarFromName(other?.name || name);

    const otherUserId = !isGroup && other?.id ? String(other.id) : null;

    const online = otherUserId ? (onlineIdsSet.has(otherUserId) ? 2 : 1) : 0;

    const lastText = c?.lastMessage?.text ?? "";
    const lastTs =
      c?.lastMessage?.createdAt ?? c?.lastMessageAt ?? c?.createdAt;

    return {
      id: String(c.id),
      type: isGroup ? "group" : "direct", // ✅ quan trọng nhất
      name,
      avatar,
      lastMessage: lastText || "Open to see messages",
      time: formatTimeOrDate(lastTs),
      unread: Number(c.unread ?? 0),
      pinned: false,
      members: members.length || 2,
      online,
      otherUserId,
      _raw: c,
    };
  });
}

// ✅ Map friend list (users) -> Friend UI
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
