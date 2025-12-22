export type TransactionType =
  | "deposit"
  | "withdrawal"
  | "contest_entry"
  | "contest_refund"
  | "contest_winnings"
  | "bonus"
  | "joining_bonus"
  | "referral"
  | "referral_bonus"
  | "coupon_purchase";

export type TransactionStatus =
  | "pending"
  | "completed"
  | "failed"
  | "cancelled";

export interface IWalletAttrs {
  id: string;
  userId: string;
  balance: number; // Total available balance (depositAmount + winningAmount)
  depositAmount: number; // Available deposit balance (includes deposits + referrals + bonuses)
  winningAmount: number; // Available winning balance from contests (used for redemptions)
  totalDeposited: number; // Lifetime total of all deposits
  totalWithdrawn: number; // Lifetime total of all withdrawals
  totalWinnings: number; // Lifetime total of contest winnings
  totalReferralEarnings: number; // Lifetime total of referral earnings
  currency: string;
  status: "active" | "suspended" | "closed";
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateWalletPayload {
  userId: string;
  balance?: number;
  currency?: string;
  status?: "active" | "suspended" | "closed";
}

export interface UpdateWalletPayload {
  balance?: number;
  depositAmount?: number;
  winningAmount?: number;
  totalDeposited?: number;
  totalWithdrawn?: number;
  totalWinnings?: number;
  totalReferralEarnings?: number;
  status?: "active" | "suspended" | "closed";
}

// ===========================
// Wallet Transaction DTO
// ===========================

export interface IWalletTransactionAttributes {
  id: string;
  walletId: string;
  userId: string;
  type: TransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceId?: string | null; // contestId, orderId, etc.
  referenceType?: string | null; // "contest", "payment", etc.
  status: TransactionStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateTransactionPayload {
  walletId: string;
  userId: string;
  type: TransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceId?: string;
  referenceType?: string;
  status?: TransactionStatus;
}
