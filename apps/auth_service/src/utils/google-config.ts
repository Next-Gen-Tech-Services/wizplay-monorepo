import { google } from "googleapis";
import ServerConfigs from "../configs/server.config";

export const oauth2client = new google.auth.OAuth2(
  ServerConfigs.GOOGLE_OAUTH_CLIENT_ID,
  ServerConfigs.GOOGLE_OAUTH_CLIENT_SECRET,
  "postmessage"
);
