import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-webauthn';

type WebAuthnP256Credential = {
  id: string;
  publicKey: {
    prefix: number;
    x: string;
    y: string;
  };
};

@Injectable()
export class WebAuthnStrategy extends PassportStrategy(Strategy, 'webauthn') {
  constructor() {
    super({
      rpName: 'Safe WebAuthn',
      rpId: process.env.RP_ID || 'localhost',
      origin: process.env.ORIGIN || 'http://localhost:3000',
      // Optional settings
      timeout: 60000,
      attestation: 'none',
      authenticatorSelection: {
        requireResidentKey: false,
        userVerification: 'preferred'
      }
    });
  }

  async validate(credential: WebAuthnP256Credential) {
    // This matches the format from WebAuthnP256.sign()
    return {
      id: credential.id,
      publicKey: {
        prefix: Number(credential.publicKey.prefix),
        x: credential.publicKey.x.toString(),
        y: credential.publicKey.y.toString()
      }
    };
  }
} 