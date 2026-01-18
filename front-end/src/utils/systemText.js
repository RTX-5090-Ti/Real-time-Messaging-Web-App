const pickId = (x) => {
  if (!x) return "";
  if (typeof x === "string" || typeof x === "number") return String(x).trim();

  if (typeof x === "object") {
    if (x.$oid) return String(x.$oid).trim();
    if (x._id) return String(x._id).trim();
    if (x.id) return String(x.id).trim();

    if (typeof x.toString === "function") {
      const s = x.toString();
      if (s && s !== "[object Object]") return String(s).trim();
    }
  }
  return "";
};

export const formatSystemText = (system, fallbackText, meId) => {
  if (!system) return fallbackText || "";

  // hỗ trợ cả "type" lẫn "action" (phòng khi mày chưa sửa leaveGroup)
  const type =
    system.type || (system.action === "leave_group" ? "member_left" : "");

  if (!type) return fallbackText || "";

  const actorName = system.actorName || "Someone";
  const actorId = pickId(system.actorId);
  const targetId = pickId(system.targetId);
  const targetName = system.targetName || "a member";
  const me = String(meId || "").trim();

  // ✅ A added B / A added you
  if (type === "member_added") {
    if (targetId && me && targetId === me) {
      return `${actorName} added you to the group`;
    }
    return `${actorName} added ${targetName} to the group`;
  }

  // ✅ A left / You left
  if (type === "member_left") {
    if (actorId && me && actorId === me) return `You left the group`;
    return `${actorName} left the group`;
  }

  return fallbackText || "";
};
