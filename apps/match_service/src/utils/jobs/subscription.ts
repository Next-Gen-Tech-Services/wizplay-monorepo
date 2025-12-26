import redis from "../../configs/redis.config";
import MatchRepository from "../../repositories/match.repository";
import MatchService from "../../services/match.service";
import { startMatchWorker, stopMatchWorker } from "../workers/manager.worker";
import { generateApiToken, forceRefreshApiToken } from "../utils";

interface Match {
  id: string;
  key: string;
  status: string;
  startedAt: number;
  endedAt: number | null;
  name: string;
}

class MatchSubscriptionService {
  private subscribedMatches: Set<string> = new Set();
  private regularCheckInterval: NodeJS.Timeout | null = null;
  private scheduledChecks: Map<string, NodeJS.Timeout> = new Map();
  private statusCheckInterval: NodeJS.Timeout | null = null;
  private matchRepository: MatchRepository;
  private matchService: MatchService;

  constructor(
    matchRepository: MatchRepository,
    matchService: MatchService
  ) {
    this.matchRepository = matchRepository;
    this.matchService = matchService;
  }

  // Helper method to get a fresh token
  private async getToken(): Promise<string> {
    const token = await generateApiToken();
    if (!token) {
      throw new Error("Failed to get Roanuz API token");
    }
    return token;
  }

  // Start monitoring matches
  public async startMonitoring(regularCheckMinutes: number = 10) {
    console.log("Starting match subscription monitoring...");

    // Load previously subscribed matches from Redis
    await this.loadSubscribedMatches();

    // Initial check and schedule
    await this.checkAndManageSubscriptions();

    // Regular interval check (can be less frequent with smart scheduling)
    this.regularCheckInterval = setInterval(
      () => {
        this.checkAndManageSubscriptions();
      },
      regularCheckMinutes * 60 * 1000
    );

    // Start periodic status check for subscribed matches (every 2 minutes)
    this.startStatusPolling(2);
  }

  // Stop monitoring
  public stopMonitoring() {
    if (this.regularCheckInterval) {
      clearInterval(this.regularCheckInterval);
      this.regularCheckInterval = null;
    }

    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
    }

    // Clear all scheduled checks
    this.scheduledChecks.forEach((timeout) => clearTimeout(timeout));
    this.scheduledChecks.clear();

    console.log("Stopped match subscription monitoring");
  }

  // Start periodic status polling for subscribed matches
  private startStatusPolling(intervalMinutes: number = 2) {
    console.log(`Starting status polling every ${intervalMinutes} minutes for subscribed matches...`);

    // Initial poll
    this.pollSubscribedMatchesStatus();

    // Set up interval
    this.statusCheckInterval = setInterval(
      () => {
        this.pollSubscribedMatchesStatus();
      },
      intervalMinutes * 60 * 1000
    );
  }

  // Poll status for all subscribed matches
  private async pollSubscribedMatchesStatus() {
    if (this.subscribedMatches.size === 0) {
      return;
    }

    console.log(`🔄 Polling status for ${this.subscribedMatches.size} subscribed matches...`);

    const matchKeys = Array.from(this.subscribedMatches);
    
    // Poll matches in parallel (but limit concurrency to avoid rate limits)
    const batchSize = 5;
    for (let i = 0; i < matchKeys.length; i += batchSize) {
      const batch = matchKeys.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (matchKey) => {
          try {
            const token = await this.getToken();
            const result = await this.matchService.fetchAndUpdateMatchStatus(
              matchKey,
              token
            );
            
            if (result.updated) {
              console.log(`✅ Updated status for match ${matchKey}: ${result.status}`);
              
              // If match completed, unsubscribe
              if (result.status === "completed") {
                await this.unsubscribeFromMatch(matchKey);
              }
            }
          } catch (error: any) {
            console.error(`❌ Error polling match ${matchKey}:`, error.message);
          }
        })
      );

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < matchKeys.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  // Load subscribed matches from Redis
  private async loadSubscribedMatches() {
    try {
      const response = await redis.getter("subscribedMatches");
      if (response) {
        const matches = JSON.parse(response);
        this.subscribedMatches = new Set(matches);
        console.log(
          `Loaded ${this.subscribedMatches.size} subscribed matches from Redis`
        );
      }
    } catch (error: any) {
      console.error("Error loading subscribed matches:", error.message);
      this.subscribedMatches = new Set();
    }
  }

  // Save subscribed matches to Redis
  private async saveSubscribedMatches() {
    try {
      await redis.setter(
        "subscribedMatches",
        JSON.stringify(Array.from(this.subscribedMatches)),
        3600 // 1 hour TTL
      );
    } catch (error: any) {
      console.error("Error saving subscribed matches:", error.message);
    }
  }

  // Main logic to check and manage subscriptions
  private async checkAndManageSubscriptions() {
    try {
      const response = await this.matchRepository.fetchAllMatches({
        sport: "cricket",
        limit: 30,
        offset: 0,
      });

      const matches = response.matches;
      const currentTime = Math.floor(Date.now() / 1000);

      for (const match of matches) {
        await this.handleMatchSubscription(match, currentTime);
        this.scheduleUpcomingMatchCheck(match, currentTime);
      }

      await this.saveSubscribedMatches();
    } catch (error: any) {
      console.error("Error in checkAndManageSubscriptions:", error.message);
    }
  }

  // Schedule a check right before match starts
  private scheduleUpcomingMatchCheck(match: Match, currentTime: number) {
    const matchId = match.key;

    // Don't schedule if match already started or ended
    if (match.status !== "not_started") {
      return;
    }

    // Don't schedule if already scheduled
    if (this.scheduledChecks.has(matchId)) {
      return;
    }

    // Calculate time until match starts (with 2-minute buffer before start)
    const timeUntilStart = match.startedAt - 120 - currentTime; // 2 minutes before

    // Only schedule if match starts within next 24 hours
    if (timeUntilStart > 0 && timeUntilStart <= 86400) {
      const timeoutMs = timeUntilStart * 1000;

      console.log(
        `📅 Scheduling check for match: ${match.name} in ${Math.round(timeUntilStart / 60)} minutes`
      );

      const timeout = setTimeout(async () => {
        console.log(`⏰ Scheduled check triggered for: ${match.name}`);
        try {
          // Fetch latest match data
          const updatedMatches = await this.matchRepository.fetchAllMatches({
            sport: "cricket",
            limit: 30,
            offset: 0,
          });

          const updatedMatch = updatedMatches.matches.find(
            (m: Match) => m.key === matchId
          );

          if (updatedMatch) {
            const now = Math.floor(Date.now() / 1000);
            await this.handleMatchSubscription(updatedMatch, now);
            await this.saveSubscribedMatches();
          }
        } catch (error: any) {
          console.error(
            `Error in scheduled check for ${matchId}:`,
            error.message
          );
        }

        this.scheduledChecks.delete(matchId);
      }, timeoutMs);

      this.scheduledChecks.set(matchId, timeout);
    }
  }

  // Handle individual match subscription logic
  private async handleMatchSubscription(match: Match, currentTime: number) {
    const matchId = match.key;
    const isSubscribed = this.subscribedMatches.has(matchId);

    // Case 1: Match has started but not subscribed yet
    if (
      match.status === "started" &&
      !isSubscribed &&
      currentTime >= match.startedAt
    ) {
      console.log(
        `🏏 Match started: ${match.name} (${matchId}). Subscribing...`
      );
      await this.subscribeToMatch(matchId);
      return;
    }

    // Case 2: Match is about to start (within 5 minutes) - preemptive subscribe
    if (
      match.status === "not_started" &&
      !isSubscribed &&
      currentTime >= match.startedAt - 300 // 5 minutes before
    ) {
      console.log(
        `⏰ Match starting soon: ${match.name} (${matchId}). Subscribing...`
      );
      await this.subscribeToMatch(matchId);
      return;
    }

    // Case 3: Match has ended and is subscribed
    if (
      (match.status === "completed" || match.status === "ended") &&
      isSubscribed
    ) {
      console.log(
        `🏁 Match ended: ${match.name} (${matchId}). Unsubscribing...`
      );
      await this.unsubscribeFromMatch(matchId);

      // Clear any scheduled checks for this match
      if (this.scheduledChecks.has(matchId)) {
        clearTimeout(this.scheduledChecks.get(matchId)!);
        this.scheduledChecks.delete(matchId);
      }
      return;
    }

    // Case 4: Match ended by endedAt timestamp
    if (match.endedAt && currentTime >= match.endedAt && isSubscribed) {
      console.log(
        `⏱️ Match time expired: ${match.name} (${matchId}). Unsubscribing...`
      );
      await this.unsubscribeFromMatch(matchId);
      return;
    }
  }

  // Subscribe to a match
  private async subscribeToMatch(matchId: string) {
    try {
      let token = await this.getToken();
      let result;
      
      try {
        result = await this.matchService.subscribeMatch(matchId, token);
      } catch (error: any) {
        // Check if it's a 401 error (invalid token)
        const errorCode = error.response?.data?.error?.code;
        const httpStatus = error.response?.data?.error?.http_status_code;
        
        if (errorCode === "A-401-0" || httpStatus === 401) {
          console.log(`⚠️ Token expired for match ${matchId}, refreshing token and retrying...`);
          
          // Force refresh the token
          const newToken = await forceRefreshApiToken();
          if (!newToken) {
            throw new Error("Failed to refresh token");
          }
          
          // Retry subscription with new token
          result = await this.matchService.subscribeMatch(matchId, newToken);
        } else {
          throw error;
        }
      }
      
      // Check if already subscribed
      if (result.already_subscribed) {
        console.log(`ℹ️ Match ${matchId} was already subscribed`);
      } else {
        console.log(`✅ Successfully subscribed to match: ${matchId}`);
      }
      
      this.subscribedMatches.add(matchId);
      startMatchWorker(matchId);
      // Immediately fetch and update match status after subscribing
      try {
        const token = await this.getToken();
        const statusResult = await this.matchService.fetchAndUpdateMatchStatus(
          matchId,
          token
        );
        if (statusResult.updated) {
          console.log(`📊 Initial status update for ${matchId}: ${statusResult.status}`);
        }
      } catch (statusError: any) {
        console.error(
          `⚠️ Failed to fetch initial status for ${matchId}:`,
          statusError.message
        );
        // Don't fail subscription if status fetch fails
      }
    } catch (error: any) {
      console.error(
        `❌ Failed to subscribe to match ${matchId}:`,
        error.message
      );
    }
  }

  // Unsubscribe from a match
  private async unsubscribeFromMatch(matchId: string) {
    try {
      const token = await this.getToken();
      const result = await this.matchService.unsubscribeMatch(matchId, token);
      
      // Check if already unsubscribed
      if (result.already_unsubscribed) {
        console.log(`ℹ️ Match ${matchId} was not subscribed or already unsubscribed`);
      } else {
        console.log(`✅ Successfully unsubscribed from match: ${matchId}`);
      }
      
      this.subscribedMatches.delete(matchId);
      stopMatchWorker(matchId);
    } catch (error: any) {
      console.error(
        `❌ Failed to unsubscribe from match ${matchId}:`,
        error.message
      );
    }
  }

  // Get currently subscribed matches (for debugging/monitoring)
  public getSubscribedMatches(): string[] {
    return Array.from(this.subscribedMatches);
  }

  // Get scheduled checks count (for debugging/monitoring)
  public getScheduledChecksCount(): number {
    return this.scheduledChecks.size;
  }

  // Get status report
  public getStatusReport() {
    return {
      subscribedMatchesCount: this.subscribedMatches.size,
      subscribedMatches: Array.from(this.subscribedMatches),
      scheduledChecksCount: this.scheduledChecks.size,
      scheduledMatches: Array.from(this.scheduledChecks.keys()),
    };
  }
}

export default MatchSubscriptionService;
