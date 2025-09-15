import { logger, ServerError } from "@repo/common";
import nodemailer from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";
import ServerConfigs from "../configs/server.config";

const createMessageTemplate = (to: string, link: string) => {
  const messageTemplate = {
    from: "noreply@wizplay.com",
    to: to,
    subject: "Reset Wizplay Password",
    html: htmlTemplate({
      name: to,
      resetLink: link,
      appName: "Wizplay",
    }),
  };
  return messageTemplate;
};

const htmlTemplate = ({
  name,
  resetLink,
  appName = "Wizplay",
}: {
  name: string;
  resetLink: string;
  appName: string;
}): string => {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Reset Your Password</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        background-color: #f4f4f4;
        margin: 0;
        padding: 0;
      }
      .container {
        max-width: 600px;
        margin: 30px auto;
        background-color: #ffffff;
        padding: 30px;
        border-radius: 8px;
        box-shadow: 0 0 10px rgba(0,0,0,0.1);
      }
      .button {
        background-color: #007bff;
        color: #ffffff;
        padding: 12px 20px;
        text-decoration: none;
        border-radius: 5px;
        display: inline-block;
        margin-top: 20px;
      }
      .footer {
        margin-top: 40px;
        font-size: 12px;
        color: #888888;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h2>Password Reset Request</h2>
      <p>Hello {{name}},</p>
      <p>We received a request to reset your password. Click the button below to choose a new one:</p>
      
      <a class="button" href="{{resetLink}}">Reset Password</a>

      <p>If you didn’t request this, you can safely ignore this email — your password will remain unchanged.</p>

      <p>Thanks,<br/>The {{appName}} Team</p>

      <div class="footer">
        If you’re having trouble, copy and paste this link into your browser:<br/>
        <a href="{{resetLink}}">{{resetLink}}</a>
      </div>
    </div>
  </body>
</html>
`
    .replace("{{name}}", name)
    .replace("{{resetLink}}", resetLink)
    .replace("{{appName}}", appName);
};

const transport = nodemailer.createTransport({
  host: ServerConfigs.SMTP_HOST,
  port: ServerConfigs.SMTP_PORT,
  auth: {
    user: ServerConfigs.SMTP_USER,
    pass: ServerConfigs.SMTP_PASS,
  },
} as unknown as SMTPTransport.Options);

export const sendResetLinkMail = (to: string, link: string): void => {
  try {
    const info = transport.sendMail(createMessageTemplate(to, link));
  } catch (err: any) {
    logger.error(`[auth_service] Error sending reset link : ${err.message}`);
    throw new ServerError("Error sending reset link");
  }
};
