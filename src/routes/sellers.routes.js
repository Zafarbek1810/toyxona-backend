import { Router } from "express";
import * as sellers from "../controllers/sellers.controller.js";
import * as payments from "../controllers/payments.controller.js";
import * as analytics from "../controllers/analytics.controller.js";
import { authenticate, requireRoles, requireSeller } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";

export const sellersRouter = Router();
sellersRouter.get("/", sellers.listSellers);

export const storesRouter = Router();
storesRouter.get("/:slug", sellers.getStoreBySlug);

export const sellerPanelRouter = Router();
sellerPanelRouter.use(authenticate, requireSeller);
sellerPanelRouter.get("/settings", sellers.getSellerSettings);
sellerPanelRouter.patch("/settings", sellers.updateSellerSettings);
sellerPanelRouter.get("/payments", payments.sellerPayments);
sellerPanelRouter.post("/payments/checkout", payments.sellerTopup);
sellerPanelRouter.get("/subscription", payments.getSellerSubscription);
sellerPanelRouter.post("/subscription", payments.subscribeSeller);
sellerPanelRouter.get("/analytics", analytics.sellerAnalytics);
sellerPanelRouter.get("/overview", analytics.sellerOverview);

export const adminSellersRouter = Router();
adminSellersRouter.use(authenticate, requireRoles("admin"));
adminSellersRouter.get("/", sellers.adminListSellers);
adminSellersRouter.post("/", upload.single("logo"), sellers.adminCreateSeller);
adminSellersRouter.patch("/:id", upload.single("logo"), sellers.adminUpdateSeller);
adminSellersRouter.delete("/:id", sellers.adminDeleteSeller);

export const plansRouter = Router();
plansRouter.get("/", payments.listPlans);

export const adminPlansRouter = Router();
adminPlansRouter.use(authenticate, requireRoles("admin"));
adminPlansRouter.get("/", payments.adminListPlans);
adminPlansRouter.post("/", payments.adminUpsertPlan);
adminPlansRouter.put("/", payments.adminUpsertPlan);

export const adminPaymentsRouter = Router();
adminPaymentsRouter.use(authenticate, requireRoles("admin"));
adminPaymentsRouter.get("/", payments.adminPayments);
