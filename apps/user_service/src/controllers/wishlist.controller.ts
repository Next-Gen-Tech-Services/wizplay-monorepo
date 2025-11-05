import { BadRequestError, logger, STATUS_CODE } from "@repo/common";
import { Request, Response } from "express";
import { autoInjectable } from "tsyringe";
import WishlistService from "../services/wishlist.service";

@autoInjectable()
export default class WishlistController {
  constructor(private readonly wishlistService: WishlistService) { }

  public add = async (req: Request, res: Response) => {
    try {
      if (!req?.currentUser?.userId) {
        throw new BadRequestError();
      }
      const { matchId } = req.body;
      const result = await this.wishlistService.addToWishlist(
        req.currentUser?.userId!,
        matchId
      );
      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        message: "Added to wishlist",
        data: result.data,
        errors: null,
        timestamp: new Date().toISOString(),
      });

    } catch (err: any) {
      logger.error("WishlistController.add error", err);
      return res.status(STATUS_CODE.INTERNAL_SERVER ?? 500).json({
        success: false,
        message: "Failed to add to wishlist",
        data: null,
        errors: (err as Error).message ?? null,
        timestamp: new Date().toISOString(),
      });
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
      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        message: "User wishlists fetched successfully",
        data: result.data,
        errors: null,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      logger.error("WishlistController.list error", err);
      return res.status(STATUS_CODE.INTERNAL_SERVER ?? 500).json({
        success: false,
        message: "Failed to fetch user wishlists",
        data: null,
        errors: (err as Error).message ?? null,
        timestamp: new Date().toISOString(),
      });
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
      return res.status(STATUS_CODE.SUCCESS).json({
        success: true,
        message: "Removed from wishlist",
        data: result,
        errors: null,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      logger.error("WishlistController.remove error", err);
      return res.status(STATUS_CODE.INTERNAL_SERVER ?? 500).json({
        success: false,
        message: "Failed to remove from wishlist",
        data: null,
        errors: (err as Error).message ?? null,
        timestamp: new Date().toISOString(),
      });
    }
  };
}
