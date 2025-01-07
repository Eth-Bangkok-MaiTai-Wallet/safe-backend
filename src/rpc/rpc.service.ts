import { Logger } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPublicClient, http, extractChain, Chain, Hex } from 'viem';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { entryPoint07Address } from 'viem/account-abstraction';
import { getChainSlug } from '../utils/pimlico.js';
import * as chains from 'viem/chains';
import { sepolia } from 'viem/chains';
import { createSmartAccountClient } from 'permissionless';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { toSafeSmartAccount } from 'permissionless/accounts';
import { MOCK_ATTESTER_ADDRESS, RHINESTONE_ATTESTER_ADDRESS } from '@rhinestone/module-sdk';
import { erc7579Actions } from 'permissionless/actions/erc7579';


@Injectable()
export class RpcService {
  private readonly logger = new Logger(RpcService.name);

  private publicClients: Map<number, ReturnType<typeof createPublicClient>> = new Map();
  private pimlicoClients: Map<number, ReturnType<typeof createPimlicoClient>> = new Map();

  constructor(private configService: ConfigService) {}

  getPublicClient(chainId: number) {
    this.logger.log(`Getting public client for chain ID: ${chainId}`);

    if (this.publicClients.has(chainId)) {
      this.logger.log(`Public client found in cache for chain ID: ${chainId}`);
      return this.publicClients.get(chainId)!;
    }

    const chain = this.getChain(chainId);
    const rpcUrl = this.getRpcUrl(chain);

    this.logger.log(`Creating new public client for chain ID: ${chainId} with RPC URL: ${rpcUrl}`);
    const publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });

    this.publicClients.set(chainId, publicClient);

    return publicClient;
  }

  getPimlicoClient(chainId: number) {
    this.logger.log(`Getting Pimlico client for chain ID: ${chainId}`);

    if (this.pimlicoClients.has(chainId)) {
      this.logger.log(`Pimlico client found in cache for chain ID: ${chainId}`);
      return this.pimlicoClients.get(chainId)!;
    }

    const apiKey = this.configService.get('PIMLICO_API_KEY');
    if (!apiKey) throw new Error('Missing PIMLICO_API_KEY');

    const chainSlug = getChainSlug(chainId);
    if (!chainSlug) throw new Error('Unsupported chain');

    const pimlicoUrl = `${this.configService.get('PIMLICO_URL')}/${chainSlug}/rpc?apikey=${apiKey}`;

    this.logger.log(`Creating new Pimlico client for chain ID: ${chainId} with URL: ${pimlicoUrl}`);
    const pimlicoClient = createPimlicoClient({
      transport: http(pimlicoUrl),
      entryPoint: {
        address: entryPoint07Address,
        version: '0.7',
      },
    });

    this.pimlicoClients.set(chainId, pimlicoClient);

    return pimlicoClient;
  }

  async createSmartAccountClient(chainId: number) {
    this.logger.log(`Creating smart account client for chain ID: ${chainId}`);

    // const privateKey = generatePrivateKey();

    const privateKey = this.configService.get('PRIVATE_KEY') as Hex;

    const creatorAccount =privateKeyToAccount(privateKey);

    this.logger.warn(`Creator account: ${creatorAccount.address}`);

    this.logger.warn(`Private key: ${privateKey}`);

    // const privateKey = this.configService.get('PRIVATE_KEY');

    this.logger.log('Creating safe smart account');
    const safeAccount = await toSafeSmartAccount({
        client: this.getPublicClient(chainId),
        owners: [creatorAccount],
        version: '1.4.1',
        entryPoint: {
          address: entryPoint07Address,
          version: '0.7',
        },
        safe4337ModuleAddress: '0x7579EE8307284F293B1927136486880611F20002',
        erc7579LaunchpadAddress: '0x7579011aB74c46090561ea277Ba79D510c6C00ff',
        attesters: [
          RHINESTONE_ATTESTER_ADDRESS, // Rhinestone Attester
          MOCK_ATTESTER_ADDRESS, // Mock Attester - do not use in production
        ],
        attestersThreshold: 1,
        saltNonce: BigInt(14),
    })

    const pimlicoClient = this.getPimlicoClient(chainId);
    const pimlicoUrl = this.getPimlicoUrl(chainId);

    this.logger.log('Creating smart account client');
    const smartAccountClient = createSmartAccountClient({
      account: safeAccount,
      chain: this.getChain(chainId),
      bundlerTransport: http(pimlicoUrl),
      paymaster: pimlicoClient,
      userOperation: {
        estimateFeesPerGas: async () => {
          return (await pimlicoClient.getUserOperationGasPrice()).fast;
        },
      },
    }).extend(erc7579Actions());

    return {smartAccountClient, privateKey};
  }

  private getChain(chainId: number): Chain {
    this.logger.log(`Getting chain for chain ID: ${chainId}`);

    let chain = extractChain({
      chains: Object.values(chains) as Chain[],
      id: chainId,
    });

    if (!chain) {
      this.logger.log(`Chain not found for chain ID: ${chainId}, using Sepolia as default`);
      chain = sepolia;
    }

    return chain;
  }

  private getRpcUrl(chain: Chain): string {
    this.logger.log(`Getting RPC URL for chain: ${chain.name}`);

    let rpcUrl = this.configService.get(`RPC_URL_${chain.id}`);

    if (!rpcUrl) {
      this.logger.log(`RPC URL not found for chain: ${chain.name}, using default Sepolia RPC URL`);
      rpcUrl = 'https://rpc.ankr.com/eth_sepolia';
    }

    return rpcUrl;
  }

  private getPimlicoUrl(chainId: number): string {
    this.logger.log(`Getting Pimlico URL for chain ID: ${chainId}`);

    const apiKey = this.configService.get('PIMLICO_API_KEY');
    if (!apiKey) throw new Error('Missing PIMLICO_API_KEY');

    const chainSlug = getChainSlug(chainId);
    if (!chainSlug) throw new Error('Unsupported chain');

    return `${this.configService.get('PIMLICO_URL')}/${chainSlug}/rpc?apikey=${apiKey}`;
  }
} 