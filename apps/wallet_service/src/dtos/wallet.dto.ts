export type TransactionType =
  | "deposit"
  | "withdrawal"
  | "contest_entry"
  | "contest_refund"
  | "contest_winnings"
  | "bonus"
  | "joining_bonus"
  | "referral";

export type TransactionStatus =
  | "pending"
  | "completed"
  | "failed"
  | "cancelled";

export interface IWalletAttrs {
  id: string;
  userId: string;
  balance: number; // Total available balance
  totalDeposited: number;
  totalWithdrawn: number;
  totalWinnings: number; // Lifetime winnings
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
  totalDeposited?: number;
  totalWithdrawn?: number;
  totalWinnings?: number;
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
