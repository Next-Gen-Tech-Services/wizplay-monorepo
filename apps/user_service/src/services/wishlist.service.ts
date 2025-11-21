// src/services/wishlist.service.ts
import { BadRequestError, logger } from "@repo/common";
import { autoInjectable } from "tsyringe";
import WishlistRepository from "../repositories/wishlist.repository";
import { KAFKA_EVENTS } from "../types";
import { publishUserEvent } from "../utils/kafka";
import axios from "axios";
import ServerConfigs from "../configs/server.config";

@autoInjectable()
export default class WishlistService {
  constructor(private readonly wishlistRepository: WishlistRepository) { }

  public async addToWishlist(userId: string, matchId: string): Promise<{ data: any; message: string }> {
    if (!matchId) {
      throw new BadRequestError("invalid matchId: must include id");
    }

    // prevent duplicates
    const existing = await this.wishlistRepository.findOneByUserAndMatchId(
      userId,
      matchId
    );
    if (existing) {
      // Fetch match data for existing item
      const matchData = await this.fetchMatchData(matchId);
      return { data: { ...existing, matchData }, message: "Already in wishlist" };
    }

    const created = await this.wishlistRepository.createWishlist(
      userId,
      matchId
    );

    // Publish event to Kafka

    if (created) {
      await publishUserEvent(KAFKA_EVENTS.USER_ADD_TO_WISHLIST, {
        userId: userId,
        matchId: matchId,
      });
      logger.debug("add to wishlist event published");
    }

    // Fetch match data for the created item
    const matchData = await this.fetchMatchData(matchId);
    return { data: { ...created, matchData }, message: "Added to wishlist" };
  }

  public async getUserWishlists(userId: string, limit = 50, offset = 0): Promise<{ data: any[] }> {
    const list = await this.wishlistRepository.findByUser(
      userId,
      limit,
      offset
    );

    // Fetch fresh match data for each wishlist item
    const wishlistsWithFreshMatchData = await Promise.all(
      list.map(async (wishlistItem: any) => {
        if (wishlistItem.matchId) {
          try {
            // Fetch latest match data from match service
            const matchResponse = await axios.get(
              `${ServerConfigs.MATCHES_SERVICE_URL}/api/v1/matches/${wishlistItem.matchId}`
            );

            return {
              ...wishlistItem,
              matchData: matchResponse.data?.data || null,
            };
          } catch (matchErr: any) {
            logger.warn(
              `Failed to fetch fresh match data for matchId ${wishlistItem.matchId}: ${matchErr?.message}`
            );
            // Return without match data if fetch fails
            return wishlistItem;
          }
        }
        return wishlistItem;
      })
    );

    return { data: wishlistsWithFreshMatchData };
  }

  public async removeFromWishlist(userId: string, matchId: string): Promise<{ message: string; matchData: any }> {
    if (!matchId) throw new BadRequestError("matchId required");

    // Check if the item exists first
    const existingItem = await this.wishlistRepository.findOneByUserAndMatchId(
      userId,
      matchId
    );

    if (!existingItem) {
      logger.warn(`Wishlist item not found for userId: ${userId}, matchId: ${matchId}`);
      throw new BadRequestError("wishlist item not found");
    }

    const deletedRows = await this.wishlistRepository.deleteByUserAndMatchId(
      userId,
      matchId
    );

    if (deletedRows === 0) {
      throw new BadRequestError("Failed to delete wishlist item");
    }

    // Publish event to Kafka to remove from match service wishlist
    try {
      await publishUserEvent(KAFKA_EVENTS.USER_REMOVE_FROM_WISHLIST, {
        userId: userId,
        matchId: matchId,
      });
      logger.debug("Remove from wishlist event published");
    } catch (err: any) {
      logger.error(`Failed to publish remove from wishlist event: ${err?.message}`);
      // Don't throw error, deletion was successful
    }

    // Fetch match data for the removed item
    const matchData = await this.fetchMatchData(matchId);
    return matchData;
  }

  private async fetchMatchData(matchId: string) {
    try {
      const matchResponse = await axios.get(
        `${ServerConfigs.MATCHES_SERVICE_URL}/api/v1/matches/${matchId}`
      );
      return matchResponse.data?.data || null;
    } catch (matchErr: any) {
      logger.warn(
        `Failed to fetch match data for matchId ${matchId}: ${matchErr?.message}`
      );
      return null;
    }
  }
}
