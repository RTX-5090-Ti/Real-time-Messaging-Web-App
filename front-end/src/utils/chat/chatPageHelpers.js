export function bumpChat(list, chatId, updater) {
  const id = String(chatId);
  const idx = list.findIndex((c) => String(c.id) === id);
  if (idx < 0) return list;

  const current = list[idx];
  const updated = typeof updater === "function" ? updater(current) : current;

  // nếu có pinned thì giữ pinned ở trên
  const pinned = list.filter((c) => c.pinned);
  const others = list.filter((c) => !c.pinned && String(c.id) !== id);

  if (updated.pinned) {
    const pinnedOthers = pinned.filter((c) => String(c.id) !== id);
    return [updated, ...pinnedOthers, ...others];
  }

  return [...pinned, updated, ...others];
}

export function getErrMsg(e) {
  return e?.response?.data?.message || e?.message || "Request failed";
}

export function notiKey(userId) {
  return `noti:${String(userId)}`;
}

export function keyOfNoti(n) {
  return `${n.type}:${n.requestId || n.id}`;
}

export function countUnread(items) {
  return (items || []).filter((x) => !x.readAt).length;
}

export function loadNotiFromLS(userId) {
  try {
    const raw = localStorage.getItem(notiKey(userId));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveNotiToLS(userId, items) {
  try {
    localStorage.setItem(notiKey(userId), JSON.stringify(items.slice(0, 50)));
  } catch {
    // ignore
  }
}
