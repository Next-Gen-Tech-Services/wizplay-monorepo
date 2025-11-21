import axios from "axios";
import { logger } from "@repo/common";
import ServerConfigs from "../configs/server.config";

/**
 * Validate if a referral code exists in the user service
 */
export async function validateReferralCode(referralCode: string): Promise<boolean> {
  try {
    const userServiceUrl = process.env.USER_SERVICE_URL || "http://localhost:4002";
    
    const response = await axios.get(
      `${userServiceUrl}/api/v1/referrals/validate/${referralCode}`,
      {
        timeout: 5000, // 5 second timeout
      }
    );

    if (response.data && response.data.success) {
      return response.data.data.isValid;
    }

    return false;
  } catch (error: any) {
    logger.error(`Error validating referral code: ${error.message}`);
    // Return false on error to prevent invalid codes from being accepted
    return false;
  }
}
