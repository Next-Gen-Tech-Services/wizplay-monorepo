import axios from "axios";
import ServerConfigs from "../configs/server.config";

export async function sendOtpUtil(
  phoneNumber: string,
  otpCode: string
): Promise<any> {
  try {
    const res = await axios.post(
      `${ServerConfigs.MSG91_BASE_URL}?template_id=${ServerConfigs.MSG91_TEMPLATE_ID}&mobile=${phoneNumber}&otp=${otpCode}`,
      {},
      {
        headers: {
          accept: "application/json",
          authkey: ServerConfigs.MSG91_AUTH_KEY as string,
          "content-type": "application/json",
        },
      }
    );
    return res.data;
  } catch (err: any) {
    console.error("MSG91 sendOtp error:", err?.response?.data || err.message);
    throw new Error("Failed to send OTP via MSG91");
  }
}
