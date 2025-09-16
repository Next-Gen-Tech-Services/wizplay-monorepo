// src/routes/wishlist.router.ts
import { Router } from "express";
import WishlistController from "../controllers/wishlist.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import WishlistRepository from "../repositories/wishlist.repository";
import WishlistService from "../services/wishlist.service";

const router = Router();
const wishlistController = new WishlistController(
  new WishlistService(new WishlistRepository() as any) as any
);

// If you have auth middleware, use it e.g. `authMiddleware`
router.post("/", requireAuth, wishlistController.add); // body: { matchData, title? }
router.get("/", requireAuth, wishlistController.list); // query: ?limit&offset
router.delete("/:matchId", requireAuth, wishlistController.remove); // route param matchId

export default router;
