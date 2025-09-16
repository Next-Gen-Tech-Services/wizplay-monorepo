// src/services/wishlist.service.ts
import { BadRequestError, logger } from "@repo/common";
import { autoInjectable } from "tsyringe";
import WishlistRepository from "../repositories/wishlist.repository";
import { KAFKA_EVENTS } from "../types";
import { publishUserEvent } from "../utils/kafka";

@autoInjectable()
export default class WishlistService {
  constructor(private readonly wishlistRepository: WishlistRepository) {}

  public async addToWishlist(userId: string, matchData: any) {
    if (!matchData || !matchData.id) {
      throw new BadRequestError("invalid matchData: must include id");
    }

    // prevent duplicates
    const existing = await this.wishlistRepository.findOneByUserAndMatchId(
      userId,
      matchData.id
    );
    if (existing) {
      return { data: existing, message: "Already in wishlist" };
    }

    const created = await this.wishlistRepository.createWishlist(
      userId,
      matchData
    );

    // Publish event to Kafka

    if (created) {
      await publishUserEvent(KAFKA_EVENTS.USER_ADD_TO_WISHLIST, {
        userId: userId,
        matchId: matchData.id,
      });
      logger.debug("add to wishlist event published");
    }

    return { data: created, message: "Added to wishlist" };
  }

  public async getUserWishlists(userId: string, limit = 50, offset = 0) {
    const list = await this.wishlistRepository.findByUser(
      userId,
      limit,
      offset
    );
    return { data: list };
  }

  public async removeFromWishlist(userId: string, matchId: string) {
    if (!matchId) throw new BadRequestError("matchId required");
    const deletedRows = await this.wishlistRepository.deleteByUserAndMatchId(
      userId,
      matchId
    );
    if (!deletedRows) {
      throw new BadRequestError("wishlist item not found");
    }
    return { message: "Removed from wishlist" };
  }
}
