import { Router } from "express";
import authRoutes from "./auth.routes.js";
import usersRoutes from "./users.routes.js";
import addressesRoutes from "./addresses.routes.js";
import productsRoutes, {
  sellerProductsRouter,
  adminProductsRouter,
  categoriesRouter,
  adminCategoriesRouter,
} from "./products.routes.js";
import { cartRouter, favoritesRouter } from "./cart.routes.js";
import {
  ordersRouter,
  sellerOrdersRouter,
  adminOrdersRouter,
  sellerReviewsRouter,
} from "./orders.routes.js";
import * as reviews from "../controllers/reviews.controller.js";
import {
  sellersRouter,
  storesRouter,
  sellerPanelRouter,
  adminSellersRouter,
  plansRouter,
  adminPlansRouter,
  adminPaymentsRouter,
} from "./sellers.routes.js";
import {
  promotionsRouter,
  adminPromotionsRouter,
  notificationsRouter,
  adminAnalyticsRouter,
  adminSettingsRouter,
  metaRouter,
} from "./misc.routes.js";
import * as analytics from "../controllers/analytics.controller.js";

const api = Router();

api.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "To'yxona API ishlayapti",
    time: new Date().toISOString(),
  });
});

api.use("/auth", authRoutes);
api.use("/users", usersRoutes);
api.use("/addresses", addressesRoutes);
api.use("/products", productsRoutes);
api.get("/products/:id/reviews", reviews.listProductReviews);
api.use("/categories", categoriesRouter);
api.use("/cart", cartRouter);
api.use("/favorites", favoritesRouter);
api.use("/orders", ordersRouter);
api.use("/sellers", sellersRouter);
api.use("/stores", storesRouter);
api.use("/subscription-plans", plansRouter);
api.use("/promotions", promotionsRouter);
api.use("/notifications", notificationsRouter);
api.use("/meta", metaRouter);
api.get("/home", analytics.home);
api.get("/regions", analytics.getRegions);

// Seller panel
api.use("/seller/products", sellerProductsRouter);
api.use("/seller/orders", sellerOrdersRouter);
api.use("/seller/reviews", sellerReviewsRouter);
api.use("/seller", sellerPanelRouter);

// Admin panel
api.use("/admin/users", usersRoutes);
api.use("/admin/sellers", adminSellersRouter);
api.use("/admin/products", adminProductsRouter);
api.use("/admin/categories", adminCategoriesRouter);
api.use("/admin/orders", adminOrdersRouter);
api.use("/admin/payments", adminPaymentsRouter);
api.use("/admin/promotions", adminPromotionsRouter);
api.use("/admin/subscription-plans", adminPlansRouter);
api.use("/admin/analytics", adminAnalyticsRouter);
api.use("/admin/settings", adminSettingsRouter);

export default api;
