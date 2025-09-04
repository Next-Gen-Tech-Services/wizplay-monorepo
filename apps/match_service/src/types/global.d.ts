import type { Logger } from "winston";

declare global {
  // Makes `logger` globally available in all TS files
  var logger: Logger;

  // For support of `global.logger`
  namespace NodeJS {
    interface Global {
      logger: Logger;
    }
  }
}

export {};
