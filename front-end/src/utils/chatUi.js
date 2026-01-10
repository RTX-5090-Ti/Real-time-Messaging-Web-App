// UI helpers for chat (avatars + time formatting)

export function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "?";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toUpperCase();
}

export function avatarFromName(name = "User") {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">
    <rect width="64" height="64" rx="32" fill="#e9d5ff"/>
    <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle"
      font-family="system-ui" font-size="26" fill="#6b21a8">
      ${initials(name)}
    </text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function formatTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function formatTimeOrDate(ts) {
  try {
    const d = new Date(ts);
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    return sameDay
      ? formatTime(ts)
      : d.toLocaleDateString([], { day: "2-digit", month: "2-digit" });
  } catch {
    return "";
  }
}
