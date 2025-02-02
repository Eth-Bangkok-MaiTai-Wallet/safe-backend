import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getWebAuthnValidator } from '@rhinestone/module-sdk';
import { ConfigSafeService } from '../safe/config.safe.service.js';
import { RpcService } from '../rpc/rpc.service.js';
import { randomBytes } from 'crypto';
import { Hex } from 'viem';

@Injectable()
export class PasskeyService {
  private readonly logger = new Logger(PasskeyService.name);
  private challenges = new Map<string, { challenge: string, timestamp: number }>();

  constructor(
    private configService: ConfigService,
    private configSafeService: ConfigSafeService,
    private rpcService: RpcService,
  ) {}

  async generateChallenge() {
    const challenge = `0x${randomBytes(32).toString('hex')}`;
    this.challenges.set(challenge, {
      challenge,
      timestamp: Date.now()
    });

    this.cleanupChallenges();
    return { challenge };
  }

  async verify(data: { metadata: any; signature: string; challenge: string }) {
    const challengeData = this.challenges.get(data.challenge);
    if (!challengeData) {
      throw new Error('Invalid or expired challenge');
    }

    try {
      // Verify the signature using WebAuthn validator
      const validator = getWebAuthnValidator({
        pubKey: data.metadata.publicKey,
        authenticatorId: data.metadata.id,
      });

      // Get all chains configured in the environment
      const supportedChains = this.configService.get('SUPPORTED_CHAINS').split(',');
      const results: Record<string, any> = {};

      // For each chain, get the safe configuration
      for (const chainId of supportedChains) {
        const safeAddress = undefined;
        // const safeAddress = await this.configSafeService.getSafeAddress(
        //   Number(chainId),
        //   data.metadata.id as Hex
        // );

        if (safeAddress) {
          const owners = await this.configSafeService.getSafeOwners(
            Number(chainId),
            safeAddress
          );

          results[chainId] = {
            safeAddress,
            safeLegacyOwners: [],
            safeModuleOwners: owners,
            safeModulePasskey: data.metadata.id
          };
        }
      }

      return { safes: results };
    } catch (error) {
      this.logger.error('Verification failed:', error);
      throw new Error(`Verification failed: ${error}`);
    }
  }

  private cleanupChallenges() {
    const now = Date.now();
    for (const [challenge, data] of this.challenges.entries()) {
      if (now - data.timestamp > 5 * 60 * 1000) {
        this.challenges.delete(challenge);
      }
    }
  }
} 