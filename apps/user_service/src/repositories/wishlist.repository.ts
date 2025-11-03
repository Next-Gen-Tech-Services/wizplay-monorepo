// src/repositories/wishlist.repository.ts
import { logger } from "@repo/common";
import { DB } from "../configs/database.config";
import ServerConfigs from "../configs/server.config";

/**
 * Add team flag URLs to match data
 */
function addTeamFlags(matchData: any): any {
  if (matchData && matchData.teams) {
    const baseUrl = ServerConfigs.MATCHES_SERVICE_URL;

    if (matchData.teams.team1 && matchData.teams.team1.code) {
      matchData.teams.team1.flag_url = `${baseUrl}api/v1/matches/flags/${matchData.teams.team1.code.toLowerCase()}.svg`;
    }
    if (matchData.teams.team2 && matchData.teams.team2.code) {
      matchData.teams.team2.flag_url = `${baseUrl}api/v1/matches/flags/${matchData.teams.team2.code.toLowerCase()}.svg`;
    }
  }
  return matchData;
}

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
    try {
      const wishlists = await this._DB.Wishlist.findAll({
        where: { userId },
        order: [["createdAt", "DESC"]],
        limit,
        offset,
      });

      // Add team flag URLs to each wishlist item's match data
      return wishlists.map((wishlist: any) => {
        const plain = wishlist.get ? wishlist.get({ plain: true }) : wishlist;
        if (plain.matchData) {
          plain.matchData = addTeamFlags(plain.matchData);
        }
        return plain;
      });
    } catch (err: any) {
      logger.error("WishlistRepository.findByUser error", err);
      throw err;
    }
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
