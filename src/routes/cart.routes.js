import { Router } from "express";
import * as cart from "../controllers/cart.controller.js";
import * as favorites from "../controllers/favorites.controller.js";
import { authenticate } from "../middleware/auth.js";

export const cartRouter = Router();
cartRouter.use(authenticate);
cartRouter.get("/", cart.getCart);
cartRouter.post("/items", cart.addToCart);
cartRouter.patch("/items/:productId", cart.updateCartItem);
cartRouter.delete("/items/:productId", cart.removeCartItem);
cartRouter.post("/promo", cart.applyPromo);

export const favoritesRouter = Router();
favoritesRouter.use(authenticate);
favoritesRouter.get("/", favorites.listFavorites);
favoritesRouter.post("/:productId", favorites.addFavorite);
favoritesRouter.delete("/:productId", favorites.removeFavorite);
favoritesRouter.post("/:productId/toggle", favorites.toggleFavorite);
