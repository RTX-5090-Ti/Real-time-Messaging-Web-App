import Notification from "../models/Notification.js";

export const listMyNotifications = async (req, res) => {
  const userId = req.user._id;

  const items = await Notification.find({ userId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  res.json({
    notifications: items.map((n) => ({
      id: String(n._id),
      type: n.type,
      data: n.data,
      readAt: n.readAt,
      createdAt: n.createdAt,
    })),
  });
};

export const markAllRead = async (req, res) => {
  const userId = req.user._id;

  await Notification.updateMany(
    { userId, readAt: null },
    { $set: { readAt: new Date() } }
  );

  res.json({ ok: true });
};
