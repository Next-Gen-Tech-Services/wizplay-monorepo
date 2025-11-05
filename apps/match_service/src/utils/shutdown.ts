import { stopSubscriptionService } from "./jobs/init-subscription";

export function shutDown(exitCode: number = 0, server?: any) {
  console.log("🛑 Shutting down server...");

  // Stop subscription service
  try {
    stopSubscriptionService();
  } catch (error) {
    console.error("Error stopping subscription service:", error);
  }

  if (server) {
    server.close(() => {
      console.info("✅ Server closed gracefully.");
      process.exit(exitCode);
    });

    // Force exit after 10 seconds if not shutting down
    setTimeout(() => {
      console.warn("⚠️ Forced shutdown after timeout.");
      process.exit(1);
    }, 10_000).unref();
  } else {
    process.exit(exitCode);
  }
}
