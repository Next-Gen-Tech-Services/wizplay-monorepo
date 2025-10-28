import { OAuth2Client } from "google-auth-library";
import ServerConfigs from "../configs/server.config";

const verifyClient = new OAuth2Client();

export async function handleGoogleAuth(idToken: string) {
  const ticket = await verifyClient.verifyIdToken({
    idToken: idToken,
    audience: [
      ServerConfigs.GOOGLE_IOS_CLIENT_ID,
      ServerConfigs.GOOGLE_ANDROID_CLIENT_ID,
    ],
  });

  return ticket;
}
