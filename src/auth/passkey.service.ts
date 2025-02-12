import { Injectable, Logger } from '@nestjs/common';
import { UserService } from '../user/user.service.js';

@Injectable()
export class PasskeyService {
  private readonly logger = new Logger(PasskeyService.name);
  // private challenges = new Map<string, { challenge: string, timestamp: number }>();

  constructor(
    private userService: UserService,
  ) {}

  // async getSafes(id: string) {
  //   try {
  //     const user = await this.userService.findByPasskeyId(id);
  //     if (!user) {
  //       throw new Error('User not found');
  //     }

  //     // Convert Map to Record for API response
  //     const safes: Record<string, any> = {};
  //     user.safes.forEach((safe, chainId) => {
  //       safes[chainId] = {
  //         safeAddress: safe.safeAddress,
  //         safeLegacyOwners: safe.safeLegacyOwners,
  //         safeModuleOwners: safe.safeModuleOwners,
  //         safeModulePasskey: safe.safeModulePasskey,
  //       };
  //     });

  //     return { safes };
  //   } catch (error) {
  //     this.logger.error('Verification failed:', error);
  //     throw new Error(`Verification failed: ${error}`);
  //   }
  // }

  async getUserByPasskeyId(id: string) {
    return this.userService.findByPasskeyId(id);
  }

  async registerPasskey(user: {username: string, id: string}, credentialId: string, pem: string) {
    try {
      const passkeyData = {
        id: credentialId,
        publicKeyPem: pem
      };

      const existingCredentials = await this.userService.findByPasskeyId(credentialId);

      if (existingCredentials) {
        throw new Error('User already exists - duplicate credentials ID');
      }

      const existingUser = await this.userService.findByUsername(user.username);

      if (existingUser) {
        throw new Error('User already exists - duplicate username');
      }

      return await this.userService.createWithPasskey(user, passkeyData);
    } catch (error) {
      this.logger.error('Registration failed:', error);
      throw new Error(`Registration failed: ${error}`);
    }
  }
} 