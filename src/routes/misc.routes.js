import { Router } from "express";
import * as promotions from "../controllers/promotions.controller.js";
import * as analytics from "../controllers/analytics.controller.js";
import { authenticate, requireRoles } from "../middleware/auth.js";

export const promotionsRouter = Router();
promotionsRouter.get("/", promotions.listActivePromotions);

export const adminPromotionsRouter = Router();
adminPromotionsRouter.use(authenticate, requireRoles("admin"));
adminPromotionsRouter.get("/", promotions.adminListPromotions);
adminPromotionsRouter.post("/", promotions.adminCreatePromotion);
adminPromotionsRouter.patch("/:id", promotions.adminUpdatePromotion);
adminPromotionsRouter.delete("/:id", promotions.adminDeletePromotion);

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);
notificationsRouter.get("/", promotions.listNotifications);
notificationsRouter.patch("/:id/read", promotions.markNotificationRead);
notificationsRouter.post("/read-all", promotions.markAllNotificationsRead);
notificationsRouter.delete("/:id", promotions.deleteNotification);

export const adminAnalyticsRouter = Router();
adminAnalyticsRouter.use(authenticate, requireRoles("admin"));
adminAnalyticsRouter.get("/", analytics.adminAnalytics);
adminAnalyticsRouter.get("/overview", analytics.adminOverview);

export const adminSettingsRouter = Router();
adminSettingsRouter.use(authenticate, requireRoles("admin"));
adminSettingsRouter.get("/", analytics.getPlatformSettings);
adminSettingsRouter.patch("/", analytics.updatePlatformSettings);

export const metaRouter = Router();
metaRouter.get("/regions", analytics.getRegions);
metaRouter.get("/home", analytics.home);
