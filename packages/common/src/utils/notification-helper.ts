import axios from 'axios';

export interface NotificationPayload {
  recipientType: 'user_id' | 'email' | 'phone' | 'all_users';
  userId?: string;
  recipientValue?: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  imageUrl?: string;
  actionUrl?: string;
}

export class NotificationHelper {
  private notificationServiceUrl: string;

  constructor(notificationServiceUrl: string = 'http://localhost:4007') {
    this.notificationServiceUrl = notificationServiceUrl;
  }

  /**
   * Send notification to user
   */
  public async sendNotification(payload: NotificationPayload): Promise<boolean> {
    try {
      await axios.post(
        `${this.notificationServiceUrl}/api/v1/notifications/send`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        }
      );
      return true;
    } catch (err: any) {
      console.error(`Failed to send notification: ${err?.message}`);
      return false;
    }
  }

  /**
   * Send wallet transaction notification
   */
  public async sendWalletNotification(
    userId: string,
    type: 'deposit' | 'withdrawal',
    amount: number,
    newBalance: number,
    transactionType: string
  ): Promise<boolean> {
    let title: string;
    let body: string;
    let notificationType: string;

    if (type === 'deposit') {
      switch (transactionType) {
        case 'joining_bonus':
          title = '🎉 Welcome Bonus Credited!';
          body = `Welcome to WizPlay! ${amount} wizcoin joining bonus has been added to your wallet. Current balance: ${newBalance} wizcoin`;
          notificationType = 'success';
          break;
        case 'contest_winnings':
          title = '🏆 Contest Winnings Credited!';
          body = `Congratulations! You won ${amount} wizcoin in a contest. Amount credited to your wallet. Current balance: ${newBalance} wizcoin`;
          notificationType = 'success';
          break;
        case 'referral_bonus':
          title = '💰 Referral Bonus Earned!';
          body = `${amount} wizcoin referral bonus has been credited to your wallet. Current balance: ${newBalance} wizcoin`;
          notificationType = 'success';
          break;
        case 'contest_refund':
          title = '↩️ Contest Entry Refunded';
          body = `${amount} wizcoin has been refunded to your wallet due to contest cancellation. Current balance: ${newBalance} wizcoin`;
          notificationType = 'info';
          break;
        default:
          title = '💳 Amount Added to Wallet';
          body = `${amount} wizcoin has been added to your wallet. Current balance: ${newBalance} wizcoin`;
          notificationType = 'wallet_update';
          break;
      }
    } else {
      switch (transactionType) {
        case 'contest_entry':
          title = '🎮 Contest Entry Fee Deducted';
          body = `${amount} wizcoin has been deducted for contest entry. Current balance: ${newBalance} wizcoin`;
          notificationType = 'info';
          break;
        case 'withdrawal':
          title = '💸 Amount Withdrawn';
          body = `${amount} wizcoin has been withdrawn from your wallet. Current balance: ${newBalance} wizcoin`;
          notificationType = 'warning';
          break;
        default:
          title = '💳 Amount Deducted from Wallet';
          body = `${amount} wizcoin has been deducted from your wallet. Current balance: ${newBalance} wizcoin`;
          notificationType = 'wallet_update';
          break;
      }
    }

    return this.sendNotification({
      recipientType: 'user_id',
      userId,
      type: notificationType,
      title,
      body,
      data: {
        transactionType: transactionType.toString(),
        amount: amount.toString(),
        newBalance: newBalance.toString(),
        type: type.toString(),
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Send contest notification
   */
  public async sendContestNotification(
    userId: string,
    contestId: string,
    eventType: 'started' | 'ending_soon' | 'ended' | 'result_declared',
    contestName?: string,
    additionalData?: Record<string, any>
  ): Promise<boolean> {
    let title: string;
    let body: string;
    let notificationType: string = 'contest_update';

    switch (eventType) {
      case 'started':
        title = '🚀 Contest Started!';
        body = contestName 
          ? `${contestName} has started! Join now to compete.`
          : `A contest has started! Join now to compete.`;
        break;
      case 'ending_soon':
        title = '⏰ Contest Ending Soon!';
        body = contestName
          ? `${contestName} is ending in 30 minutes. Submit your answers now!`
          : `Contest is ending in 30 minutes. Submit your answers now!`;
        notificationType = 'warning';
        break;
      case 'ended':
        title = '🏁 Contest Ended';
        body = contestName
          ? `${contestName} has ended. Results will be declared soon.`
          : `Contest has ended. Results will be declared soon.`;
        notificationType = 'info';
        break;
      case 'result_declared':
        title = '📊 Contest Results Declared!';
        body = contestName
          ? `Results for ${contestName} are now available. Check your ranking!`
          : `Contest results are now available. Check your ranking!`;
        notificationType = 'success';
        break;
    }

    return this.sendNotification({
      recipientType: 'user_id',
      userId,
      type: notificationType,
      title,
      body,
      data: {
        contestId: contestId?.toString() || '',
        eventType: eventType.toString(),
        contestName: contestName?.toString() || '',
        timestamp: new Date().toISOString(),
        // Convert all additional data values to strings
        ...(additionalData ? Object.fromEntries(
          Object.entries(additionalData).map(([key, value]) => [
            key, 
            value?.toString() || ''
          ])
        ) : {})
      }
    });
  }

  /**
   * Send match notification
   */
  public async sendMatchNotification(
    userIds: string | string[],
    matchId: string,
    eventType: 'starting_soon' | 'started' | 'live_update' | 'ended',
    matchName?: string,
    additionalData?: Record<string, any>
  ): Promise<boolean> {
    let title: string;
    let body: string;
    let notificationType: string = 'match_update';

    switch (eventType) {
      case 'starting_soon':
        title = '⚽ Match Starting Soon!';
        body = matchName
          ? `${matchName} is starting in 30 minutes. Get ready!`
          : `Match is starting in 30 minutes. Get ready!`;
        notificationType = 'info';
        break;
      case 'started':
        title = '🎮 Match Started!';
        body = matchName
          ? `${matchName} has started! Follow live updates.`
          : `Match has started! Follow live updates.`;
        break;
      case 'live_update':
        title = '📢 Live Match Update';
        body = additionalData?.update || 'Important match update available!';
        break;
      case 'ended':
        title = '🏆 Match Ended';
        body = matchName
          ? `${matchName} has ended. Check the final results!`
          : `Match has ended. Check the final results!`;
        notificationType = 'success';
        break;
    }

    const users = Array.isArray(userIds) ? userIds : [userIds];
    const results = await Promise.allSettled(
      users.map(userId => this.sendNotification({
        recipientType: 'user_id',
        userId,
        type: notificationType,
        title,
        body,
        data: {
          matchId: matchId?.toString() || '',
          eventType: eventType.toString(),
          matchName: matchName?.toString() || '',
          timestamp: new Date().toISOString(),
          // Convert all additional data values to strings
          ...(additionalData ? Object.fromEntries(
            Object.entries(additionalData).map(([key, value]) => [
              key, 
              value?.toString() || ''
            ])
          ) : {})
        }
      }))
    );

    return results.some(result => result.status === 'fulfilled' && result.value);
  }
}

// Export a default instance
export const notificationHelper = new NotificationHelper();