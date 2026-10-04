import { Router } from "express";
import * as users from "../controllers/users.controller.js";
import { authenticate, requireRoles } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/me", users.getMe);
router.patch("/me", users.updateMe);
router.post("/me/change-password", users.changePassword);
router.delete("/me", users.deleteMe);
router.get("/me/settings", users.getSettings);
router.patch("/me/settings", users.updateSettings);

router.get("/", requireRoles("admin"), users.adminListUsers);
router.patch("/:id", requireRoles("admin"), users.adminUpdateUser);
router.delete("/:id", requireRoles("admin"), users.adminDeleteUser);

export default router;
