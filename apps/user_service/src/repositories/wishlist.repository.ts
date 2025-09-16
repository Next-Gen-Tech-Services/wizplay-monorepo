// src/repositories/wishlist.repository.ts
import { logger } from "@repo/common";
import { DB } from "../configs/database.config";

export default class WishlistRepository {
  private _DB = DB;

  public async createWishlist(userId: string, matchData: any) {
    try {
      const result = await this._DB.Wishlist.create({
        userId,
        matchData,
      });
      return result;
    } catch (err: any) {
      logger.error("WishlistRepository.createWishlist error", err);
      throw err;
    }
  }

  public async findByUser(userId: string, limit = 50, offset = 0) {
    return this._DB.Wishlist.findAll({
      where: { userId },
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });
  }

  public async findByMatchId(userId: string, matchId: string) {
    return this._DB.Wishlist.findOne({
      where: this._DB.Sequelize.where(
        this._DB.Sequelize.cast(
          this._DB.Sequelize.json("match_data.id"),
          "text"
        ),
        matchId
      ),
    });
  }

  public async findOneByUserAndMatchId(userId: string, matchId: string) {
    const Sequelize = this._DB.Sequelize;
    return this._DB.Wishlist.findOne({
      where: {
        userId,
        [Sequelize.Op.and]: Sequelize.where(
          Sequelize.json("match_data.id"),
          matchId
        ),
      },
    });
  }

  public async deleteById(id: string) {
    return this._DB.Wishlist.destroy({ where: { id } });
  }

  public async deleteByUserAndMatchId(userId: string, matchId: string) {
    const Sequelize = this._DB.Sequelize;
    return this._DB.Wishlist.destroy({
      where: {
        userId,
        [Sequelize.Op.and]: Sequelize.where(
          Sequelize.json("match_data.id"),
          matchId
        ),
      },
    });
  }
}
