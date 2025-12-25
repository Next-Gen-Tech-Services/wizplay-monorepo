export interface IAuthAtters {
  id: string;
  userId: string;
  email?: string | null;
  phoneNumber?: string | null;
  appleUserId?: string | null;
  provider: "local" | "google" | "apple" | "email";
  password?: string | null;
  otpCode?: string | null;
  otpExpiresAt?: Date | null;
  lastLoginAt?: Date | null;
  onboarded: boolean;
  type: "user" | "admin";
  createdAt?: Date;
  updatedAt?: Date;
}
