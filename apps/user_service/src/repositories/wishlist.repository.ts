// src/repositories/wishlist.repository.ts
import { logger } from "@repo/common";
import { DB } from "../configs/database.config";

export default class WishlistRepository {
  private _DB = DB;

  public async createWishlist(userId: string, matchId: string) {
    try {
      const result = await this._DB.Wishlist.create({
        userId,
        matchId,
      });
      return result;
    } catch (err: any) {
      logger.error("WishlistRepository.createWishlist error", err);
      throw err;
    }
  }

  public async findByUser(userId: string, limit = 50, offset = 0) {
    try {
      const wishlists = await this._DB.Wishlist.findAll({
        where: { userId },
        order: [["createdAt", "DESC"]],
        limit,
        offset,
      });

      // Return plain wishlist items with matchId
      return wishlists.map((wishlist: any) => {
        const plain = wishlist.get ? wishlist.get({ plain: true }) : wishlist;
        return plain;
      });
    } catch (err: any) {
      logger.error("WishlistRepository.findByUser error", err);
      throw err;
    }
  }

  public async findByMatchId(userId: string, matchId: string) {
    return this._DB.Wishlist.findOne({
      where: {
        userId,
        matchId,
      },
    });
  }

  public async findOneByUserAndMatchId(userId: string, matchId: string) {
    return this._DB.Wishlist.findOne({
      where: {
        userId,
        matchId,
      },
    });
  }

  public async deleteById(id: string) {
    return this._DB.Wishlist.destroy({ where: { id } });
  }

  public async deleteByUserAndMatchId(userId: string, matchId: string) {
    return this._DB.Wishlist.destroy({
      where: {
        userId,
        matchId,
      },
    });
  }
}
