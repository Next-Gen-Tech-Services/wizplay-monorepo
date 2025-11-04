export interface NotificationPayload {
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  data?: Record<string, any>;
  imageUrl?: string;
  actionUrl?: string;
  priority?: 'high' | 'normal';
}

export enum NotificationType {
  // Auth notifications
  WELCOME = 'welcome',
  LOGIN_SUCCESS = 'login_success',
  PASSWORD_RESET = 'password_reset',
  
  // Contest notifications
  CONTEST_JOINED = 'contest_joined',
  CONTEST_STARTING = 'contest_starting',
  CONTEST_WON = 'contest_won',
  CONTEST_LOST = 'contest_lost',
  CONTEST_RESULT = 'contest_result',
  
  // Wallet notifications
  WALLET_CREDIT = 'wallet_credit',
  WALLET_DEBIT = 'wallet_debit',
  WITHDRAWAL_SUCCESS = 'withdrawal_success',
  WITHDRAWAL_FAILED = 'withdrawal_failed',
  
  // Match notifications
  MATCH_STARTED = 'match_started',
  MATCH_ENDED = 'match_ended',
  
  // General
  SYSTEM_ALERT = 'system_alert',
  PROMOTIONAL = 'promotional',
  REFERRAL_REWARD = 'referral_reward',
}

export interface FirebaseConfig {
  projectId: string;
  privateKey: string;
  clientEmail: string;
}

export interface SendNotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface BulkNotificationPayload {
  userIds: string[];
  title: string;
  body: string;
  type: NotificationType;
  data?: Record<string, any>;
  imageUrl?: string;
}

export interface NotificationTemplate {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
}
