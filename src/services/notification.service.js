import Notification from "../models/notification.model.js";

export const notifyPickupEvent = ({ recipientId, pickupId, event, title, message }) => {
  if (!recipientId) return null;
  return Notification.create({ recipientId, pickupId, event, title, message });
};

export const getUserNotifications = (recipientId) => Notification.find({ recipientId }).populate("pickupId", "pickupId status wasteType").sort({ createdAt: -1 }).limit(100);
export const markNotificationRead = (id, recipientId) => Notification.findOneAndUpdate({ _id: id, recipientId }, { isRead: true }, { new: true });
export const markAllNotificationsRead = (recipientId) => Notification.updateMany({ recipientId, isRead: false }, { isRead: true });
