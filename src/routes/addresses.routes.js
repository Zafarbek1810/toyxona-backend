import { Router } from "express";
import * as addresses from "../controllers/addresses.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();
router.use(authenticate);

router.get("/", addresses.listAddresses);
router.post("/", addresses.createAddress);
router.patch("/:id", addresses.updateAddress);
router.delete("/:id", addresses.deleteAddress);
router.post("/:id/default", addresses.setDefaultAddress);

export default router;
