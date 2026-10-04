import { Router } from "express";
import * as orders from "../controllers/orders.controller.js";
import * as reviews from "../controllers/reviews.controller.js";
import { authenticate, requireRoles, requireSeller } from "../middleware/auth.js";

export const ordersRouter = Router();
ordersRouter.use(authenticate);
ordersRouter.post("/", orders.createOrder);
ordersRouter.get("/", orders.listMyOrders);
ordersRouter.get("/:id", orders.getMyOrder);
ordersRouter.post("/:id/reviews", reviews.createOrderReview);

export const sellerOrdersRouter = Router();
sellerOrdersRouter.use(authenticate, requireSeller);
sellerOrdersRouter.get("/", orders.sellerListOrders);
sellerOrdersRouter.patch("/:id/status", orders.sellerUpdateOrderStatus);

export const adminOrdersRouter = Router();
adminOrdersRouter.use(authenticate, requireRoles("admin"));
adminOrdersRouter.get("/", orders.adminListOrders);
adminOrdersRouter.get("/:id", orders.adminGetOrder);

export const productReviewsRouter = Router({ mergeParams: true });
productReviewsRouter.get("/", reviews.listProductReviews);

export const sellerReviewsRouter = Router();
sellerReviewsRouter.use(authenticate, requireSeller);
sellerReviewsRouter.get("/", reviews.sellerListReviews);
sellerReviewsRouter.post("/:id/reply", reviews.sellerReplyReview);
