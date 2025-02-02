import { Injectable } from '@nestjs/common';
import { verifyMessage } from 'viem';

@Injectable()
export class SiweService {
  async verify(data: { address: string; message: string; signature: string }) {
    const isValid = await verifyMessage({
      address: data.address as `0x${string}`,
      message: data.message,
      signature: data.signature as `0x${string}`,
    });

    if (!isValid) {
      throw new Error('Invalid signature');
    }

    // TODO: Get user's safes based on Ethereum address
    // This will need to interact with your database

    return {
      safes: {} // Return user's safes
    };
  }
} 