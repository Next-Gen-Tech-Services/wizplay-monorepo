import axios from "axios";
import ServerConfigs from "../configs/server.config";
import { logger } from "@repo/common";

export async function sendOtpUtil(phoneNumber: string): Promise<any> {
  try {
    const url = `${ServerConfigs.MSG91_BASE_URL}otp?mobile=${phoneNumber}&authkey=${ServerConfigs.MSG91_AUTH_KEY}&otp_expiry=5&template_id=${ServerConfigs.MSG91_TEMPLATE_ID}&realTimeResponse=1`;

    logger.info(`MSG91 URL : ${url}`);
    const body = {
     };

    const res = await axios.post(url, body, {
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
      },
    });

    logger.info(`MSG91 Response : ${JSON.stringify(res.data)}`);

    return res.data;
  } catch (err: any) {
    logger.error("MSG91 sendOtp error:", err?.response?.data || err.message);
    throw new Error("Failed to send OTP via MSG91");
  }
}
export async function verifyOtpUtil(
  phoneNumber: string,
  otpCode: string
): Promise<any> {
  try {
    const url = `${ServerConfigs.MSG91_BASE_URL}otp/verify?otp=${otpCode}&mobile=${phoneNumber}`;

    const res = await axios.get(url, {
      headers: {
        authkey: ServerConfigs.MSG91_AUTH_KEY as string,
        accept: "application/json",
      },
    });

    return res.data;
  } catch (err: any) {
    console.error("MSG91 verifyOtp error:", err?.response?.data || err.message);
    throw new Error("Failed to verify OTP via MSG91");
  }
}
