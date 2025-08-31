export interface IAuthAtters {
  id: string;
  userId: string;
  email?: string | null;
  phoneNumber?: string | null;
  provider: "local" | "google" | "apple";
  otpCode?: string | null;
  otpExpiresAt?: Date | null;
  lastLoginAt?: Date | null;
  onboarded: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}