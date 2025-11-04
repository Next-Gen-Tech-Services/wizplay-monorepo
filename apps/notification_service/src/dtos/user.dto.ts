import { Language } from "../types";

export interface IUserAttributes {
  id: string;
  userId: string;
  authId: string;
  email?: string | null;
  name?: string | null;
  userName: string;
  phoneNumber?: string | null;
  onboarded: boolean;
  type: "user" | "admin";
  selectedLanguage: Language;
  createdAt?: Date;
  updatedAt?: Date;
}
