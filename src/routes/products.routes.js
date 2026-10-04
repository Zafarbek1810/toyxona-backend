import { Router } from "express";
import * as products from "../controllers/products.controller.js";
import { authenticate, optionalAuth, requireRoles, requireSeller } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";

const router = Router();

router.get("/", products.listProducts);
router.get("/:id", optionalAuth, products.getProduct);
router.get("/:id/similar", products.similarProducts);

export const sellerProductsRouter = Router();
sellerProductsRouter.use(authenticate, requireSeller);
sellerProductsRouter.get("/", products.sellerListProducts);
sellerProductsRouter.get("/:id", products.sellerGetProduct);
sellerProductsRouter.post("/", upload.array("images", 10), products.sellerCreateProduct);
sellerProductsRouter.patch("/:id", upload.array("images", 10), products.sellerUpdateProduct);
sellerProductsRouter.delete("/:id", products.sellerDeleteProduct);

export const adminProductsRouter = Router();
adminProductsRouter.use(authenticate, requireRoles("admin"));
adminProductsRouter.get("/", products.adminListProducts);
adminProductsRouter.post("/:id/:action", products.adminModerateProduct);

export const categoriesRouter = Router();
categoriesRouter.get("/", products.listCategories);

export const adminCategoriesRouter = Router();
adminCategoriesRouter.use(authenticate, requireRoles("admin"));
adminCategoriesRouter.get("/", products.adminListCategories);
adminCategoriesRouter.post("/", upload.single("icon"), products.adminCreateCategory);
adminCategoriesRouter.patch("/:id", upload.single("icon"), products.adminUpdateCategory);
adminCategoriesRouter.delete("/:id", products.adminDeleteCategory);
adminCategoriesRouter.post("/:id/subcategories", upload.single("icon"), products.adminCreateSubcategory);
adminCategoriesRouter.patch("/:id/subcategories/:subId", upload.single("icon"), products.adminUpdateSubcategory);
adminCategoriesRouter.delete("/:id/subcategories/:subId", products.adminDeleteSubcategory);

export default router;
