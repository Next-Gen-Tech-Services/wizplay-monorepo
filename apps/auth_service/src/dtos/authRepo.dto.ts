export interface IUpdateOTP {
  phoneNumber: string;
  otpCode: string;
}

export interface ICreatePhoneAuthUser {
  phoneNumber: string;
  userId: string;
  provider: "local"
}