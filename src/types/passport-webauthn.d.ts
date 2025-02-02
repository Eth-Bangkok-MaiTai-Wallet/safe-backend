declare module 'passport-webauthn' {
  import { Strategy as PassportStrategy } from 'passport';
  
  export class Strategy extends PassportStrategy {
    constructor(options: {
      rpName: string;
      rpId: string;
      origin: string;
      timeout?: number;
      attestation?: string;
      authenticatorSelection?: {
        requireResidentKey?: boolean;
        userVerification?: string;
      };
    });
  }
} 