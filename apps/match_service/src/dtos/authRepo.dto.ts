export interface IUpdateOTP {
  phoneNumber: string;
  otpCode: string;
}

export interface ICreatePhoneAuthUser {
  phoneNumber: string;
  userId: string;
  provider: "local";
}

export interface IVerifyOtpPayload {
  phoneNumber: string;
  otpCode: string;
}

export interface IClearOtpPayload {
  phoneNumber: string;
  lastLoginAt?: Date;
}
