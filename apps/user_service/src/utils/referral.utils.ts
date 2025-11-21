/**
 * Generate a unique referral code
 * Format: PREFIX + 6 random alphanumeric characters (uppercase)
 * Example: WIZ8A3X9K
 */
export function generateReferralCode(prefix: string = "WIZ"): string {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let randomPart = "";
  
  // Generate 6 random characters
  for (let i = 0; i < 6; i++) {
    randomPart += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  
  return `${prefix}${randomPart}`;
}

/**
 * Validate referral code format
 */
export function isValidReferralCode(code: string): boolean {
  // Format: 3 uppercase letters + 6 alphanumeric characters
  const pattern = /^[A-Z]{3}[A-Z0-9]{6}$/;
  return pattern.test(code);
}
