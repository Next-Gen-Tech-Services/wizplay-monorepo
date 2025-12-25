export interface IGoogleResponse {
  firstName: string;
  lastName: string;
  email: string;
  profileImage: string | null;
}

export interface IAppleResponse {
  firstName?: string;
  lastName?: string;
  email?: string;
  appleUserId: string; // Apple's unique user identifier (sub)
}
