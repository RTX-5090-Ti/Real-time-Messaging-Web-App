export function visibleReadCandidate(root, entries, visible, focused) {
  if (!visible || !focused || root.width <= 0 || root.height <= 0) return null;
  return entries.filter(({ id, rect }) => !String(id).startsWith("tmp:") &&
    rect.width > 0 && rect.height > 0 && rect.bottom > root.top && rect.bottom <= root.bottom + 1 &&
    rect.right > root.left && rect.left < root.right).at(-1)?.id || null;
}

