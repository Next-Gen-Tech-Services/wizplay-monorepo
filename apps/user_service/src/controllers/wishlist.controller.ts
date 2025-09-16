import { BadRequestError, logger } from "@repo/common";
import { Request, Response } from "express";
import { autoInjectable } from "tsyringe";
import WishlistService from "../services/wishlist.service";

@autoInjectable()
export default class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  public add = async (req: Request, res: Response) => {
    try {
      if (!req?.currentUser?.userId) {
        throw new BadRequestError();
      }
      const { matchData } = req.body;
      const result = await this.wishlistService.addToWishlist(
        req.currentUser?.userId!,
        matchData
      );
      return res.status(201).json({ success: true, ...result });
    } catch (err: any) {
      logger.error("WishlistController.add error", err);
      return res.status(400).json({ success: false, error: err.message });
    }
  };

  public list = async (req: Request, res: Response) => {
    try {
      if (!req?.currentUser?.userId) {
        throw new BadRequestError();
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const result = await this.wishlistService.getUserWishlists(
        req.currentUser?.userId!,
        limit,
        offset
      );
      return res.status(200).json({ success: true, ...result });
    } catch (err: any) {
      logger.error("WishlistController.list error", err);
      return res.status(400).json({ success: false, error: err.message });
    }
  };

  public remove = async (req: Request, res: Response) => {
    try {
      if (!req?.currentUser?.userId) {
        throw new BadRequestError();
      }

      const matchId = req.params.matchId || req.body.matchId;
      const result = await this.wishlistService.removeFromWishlist(
        req.currentUser?.userId!,
        matchId
      );
      return res.status(200).json({ success: true, ...result });
    } catch (err: any) {
      logger.error("WishlistController.remove error", err);
      return res.status(400).json({ success: false, error: err.message });
    }
  };
}
