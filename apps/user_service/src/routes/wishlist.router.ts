// src/routes/wishlist.router.ts
import { Request, Response, Router } from "express";
import WishlistController from "../controllers/wishlist.controller";
import { requireAuth } from "../middlewares/auth.middleware";
import { container } from "tsyringe";

const router = Router();
const wishlistController: WishlistController = container.resolve(WishlistController);

// If you have auth middleware, use it e.g. `authMiddleware`

router.post("/", requireAuth, async (req: Request, res: Response) => {
  const result = await wishlistController.add(req, res);
  return result;
});
router.get("/", requireAuth, async (req: Request, res: Response) => {
  const result = await wishlistController.list(req, res);
  return result;
});
router.delete("/:matchId", requireAuth, async (req: Request, res: Response) => {
  const result = await wishlistController.remove(req, res);
  return result;
});

export default router;
