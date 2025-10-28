// src/events/coupon.event.handler.ts
import { logger, ServerError } from "@repo/common";
import CouponRepository from "../../repositories/coupon.repository";
import CouponService from "../../services/coupon.service";
import { KAFKA_EVENTS } from "../../types";
import { kafkaClient } from "../kafka"; // adjust path to your kafka client

class CouponEventHandler {
  private repo: CouponRepository;
  private service: CouponService;

  constructor() {
    this.repo = new CouponRepository();
    this.service = new CouponService(this.repo);
  }

  public async handle(): Promise<void> {
    try {
      // subscribeMultiple expects a callback(message) and a list of event names/topics
      await kafkaClient.subscribeMultiple(
        async (message: any) => {
          try {
            logger.info("CouponEventHandler received message", { message });
            // message.event should be one of KAFKA_EVENTS
            switch (message.event) {
              case KAFKA_EVENTS.COUPON_CREATED:
                await this.onCreated(message.data);
                break;
              case KAFKA_EVENTS.COUPON_UPDATED:
                await this.onUpdated(message.data);
                break;
              case KAFKA_EVENTS.COUPON_DELETED:
                await this.onDeleted(message.data);
                break;
              case KAFKA_EVENTS.COUPON_TOGGLED:
                await this.onToggled(message.data);
                break;
              case KAFKA_EVENTS.COUPON_USED:
                await this.onUsed(message.data);
                break;
              case KAFKA_EVENTS.COUPON_USED:
                await this.onUsed(message.data);
                break;
              case KAFKA_EVENTS.GENERATE_CONTEST:
                await this.onContestGenerated(message.data);
                break;
              default:
                logger.warn("Unhandled coupon event", { event: message.event });
            }
          } catch (err: any) {
            logger.error({ err, message }, "Error handling coupon event");
            // do not crash consumer loop — you may want to rethrow to let client handle retries depending on kafkaClient impl
          }
        },
        Object.values(KAFKA_EVENTS) // subscribe to all coupon events
      );
      logger.info("CouponEventHandler subscribed to coupon events");
    } catch (error: any) {
      logger.error({ error }, "Failed to subscribe coupon events");
      throw new ServerError("Error starting coupon event handler");
    }
  }

  private async onCreated(data: any) {
    // data should include coupon payload: { id, code, ... }
    logger.info("Handling coupon created", { id: data?.id, code: data?.code });
    // example: create locally or update cache
    try {
      await this.repo.createCoupon(data);
      logger.info("Coupon persisted from event", { id: data?.id });
    } catch (err: any) {
      // if it already exists, you may ignore or update
      logger.warn("Persist coupon from event failed, attempting update", {
        err: err?.message,
      });
      try {
        await this.repo.updateCoupon(data.id, data);
      } catch (e) {
        logger.error({ err: e }, "Failed to persist coupon from event");
      }
    }
  }

  private async onUpdated(data: any) {
    logger.info("Handling coupon updated", { id: data?.id });
    try {
      await this.repo.updateCoupon(data.id, data);
      logger.info("Coupon updated from event", { id: data?.id });
    } catch (err: any) {
      logger.error({ err }, "Failed to update coupon from event");
    }
  }

  private async onDeleted(data: any) {
    logger.info("Handling coupon deleted", { id: data?.id });
    try {
      await this.repo.deleteCoupon(data.id);
      logger.info("Coupon deleted from event", { id: data?.id });
    } catch (err: any) {
      logger.error({ err }, "Failed to delete coupon from event");
    }
  }

  private async onToggled(data: any) {
    logger.info("Handling coupon toggled", {
      id: data?.id,
      status: data?.status,
    });
    try {
      // ensure local state updated to reflect status
      await this.repo.updateCoupon(data.id, { status: data.status });
      logger.info("Coupon status updated from event", {
        id: data?.id,
        status: data?.status,
      });
    } catch (err: any) {
      logger.error({ err }, "Failed to toggle coupon from event");
    }
  }

  private async onUsed(data: any) {
    // data expected: { id, userId, orderId, usageDelta=1 }
    logger.info("Handling coupon used", { id: data?.id, userId: data?.userId });
    try {
      // increment usage count safely
      const coupon = await this.repo.getCouponById(data.id);
      if (!coupon) {
        logger.warn("Coupon not found for usage event", { id: data?.id });
        return;
      }
      const newCount = (coupon.usageCount ?? 0) + (data.usageDelta ?? 1);
      await this.repo.updateCoupon(data.id, { usageCount: newCount });
      logger.info("Coupon usage updated", {
        id: data?.id,
        usageCount: newCount,
      });
    } catch (err: any) {
      logger.error({ err }, "Failed to process coupon used event");
    }
  }

  private async onContestGenerated(data: any) {
    logger.info(
      `Handling contest generated event": ${{
        matchId: data?.matchId,
        contestCount: data?.contests?.length,
      }}`
    );

    try {
      if (!data?.contests || !Array.isArray(data.contests)) {
        logger.warn("Invalid contest data in event", { data });
        return;
      }

      // Extract contest data
      const contestsData = data.contests.map((contest: any) => ({
        id: contest.id,
        matchId: contest.matchId || data.matchId,
        platform: contest.platform || "default",
      }));

      logger.info("Assigning coupons to contests", {
        count: contestsData.length,
      });

      // Call service to assign coupons to all contests
      const result = await this.service.assignCoupons(contestsData);

      logger.info("Successfully assigned coupons to contests", {
        matchId: data.matchId,
        contestsProcessed: result.count,
        totalCouponsAssigned: result.count * 3,
      });

      // await kafkaClient.publish(KAFKA_EVENTS.COUPONS_ASSIGNED, result);
    } catch (err: any) {
      logger.error(
        {
          err,
          matchId: data?.matchId,
          message: err?.message,
        },
        "Failed to assign coupons to contests"
      );

      // You might want to publish a failure event here
      // await kafkaClient.publish(KAFKA_EVENTS.COUPONS_ASSIGNMENT_FAILED, {
      //   matchId: data?.matchId,
      //   error: err?.message
      // });
    }
  }
}

export default new CouponEventHandler();
