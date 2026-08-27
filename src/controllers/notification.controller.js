import ApiResponse from "../utils/apiResponse.js";
import { getUserNotifications, markAllNotificationsRead, markNotificationRead } from "../services/notification.service.js";

export const listNotificationsController = async (req, res, next) => { try { const items = await getUserNotifications(req.user._id); res.json(new ApiResponse(200, items, "Notifications fetched")); } catch (error) { next(error); } };
export const readNotificationController = async (req, res, next) => { try { const item = await markNotificationRead(req.params.id, req.user._id); res.json(new ApiResponse(200, item, "Notification marked as read")); } catch (error) { next(error); } };
export const readAllNotificationsController = async (req, res, next) => { try { await markAllNotificationsRead(req.user._id); res.json(new ApiResponse(200, null, "All notifications marked as read")); } catch (error) { next(error); } };
