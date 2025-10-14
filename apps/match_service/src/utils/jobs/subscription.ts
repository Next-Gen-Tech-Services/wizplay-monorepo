import redis from "../../configs/redis.config";
import MatchRepository from "../../repositories/match.repository";
import MatchService from "../../services/match.service";

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
  private matchRepository: MatchRepository;
  private matchService: MatchService;
  public token: string;

  constructor(
    token: string,
    matchRepository: MatchRepository,
    matchService: MatchService
  ) {
    this.token = token;
    this.matchRepository = matchRepository;
    this.matchService = matchService;
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
  }

  // Stop monitoring
  public stopMonitoring() {
    if (this.regularCheckInterval) {
      clearInterval(this.regularCheckInterval);
      this.regularCheckInterval = null;
    }

    // Clear all scheduled checks
    this.scheduledChecks.forEach((timeout) => clearTimeout(timeout));
    this.scheduledChecks.clear();

    console.log("Stopped match subscription monitoring");
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
        JSON.stringify(Array.from(this.subscribedMatches))
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
      await this.matchService.subscribeMatch(matchId, this.token);
      this.subscribedMatches.add(matchId);
      console.log(`✅ Successfully subscribed to match: ${matchId}`);
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
      await this.matchService.unsubscribeMatch(matchId, this.token);
      this.subscribedMatches.delete(matchId);
      console.log(`✅ Successfully unsubscribed from match: ${matchId}`);
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
