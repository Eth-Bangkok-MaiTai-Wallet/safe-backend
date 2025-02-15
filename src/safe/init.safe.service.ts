import { Logger } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Hex, http, keccak256, parseEventLogs, PublicClient } from 'viem';
import { RpcService } from '../rpc/rpc.service.js';
import { encodeValidatorNonce, getAccount, getOwnableValidator, getOwnableValidatorOwners } from '@rhinestone/module-sdk';
import { privateKeyToAccount } from 'viem/accounts';
import { entryPoint07Address } from 'viem/account-abstraction';
import { getAccountNonce } from 'permissionless/actions';
import { TransactSafeService } from './transact.safe.service.js';
import { getContractABI } from '../utils/etherscan.js';
import { createWalletClient } from 'viem';
import { safeAbi } from '../utils/abi/safe.abi.js';
import { ConfigSafeService } from './config.safe.service.js';
import { Erc7579SafeService } from './erc7579.safe.service.js';
import { SafeOwnerConfig } from './Typres.js';

@Injectable()
export class InitSafeService {
  private readonly logger = new Logger(InitSafeService.name);

  constructor(
    private configService: ConfigService,
    private rpcService: RpcService,
    private transactSafeService: TransactSafeService,
    private configSafeService: ConfigSafeService,
    private erc7579SafeService: Erc7579SafeService,
  ) {}

  async initSafeWithOwner(ownerAddress: Hex, chainId: number) {
    this.logger.log(`Initializing safe for owner address: ${ownerAddress} on chain ID: ${chainId}`);

    const apiKey = this.configService.get('PIMLICO_API_KEY');
    if (!apiKey) throw new Error('Missing PIMLICO_API_KEY');

    const createClientData = {
      chainId
    }
    const { smartAccountClient, privateKey } = await this.rpcService.createSmartAccountClient(createClientData);

    await this.erc7579SafeService.installOwnableValidatorModule(smartAccountClient, [ownerAddress], 1);

    const zeroBytes32 = "0x0000000000000000000000000000000000000000";

    const unspendableAddress = keccak256(zeroBytes32).substring(0, 42);

    this.logger.log(`Adding unspendable owner address: ${unspendableAddress}`);

    await this.configSafeService.addSafeOwner({
      safeAddress: smartAccountClient.account!.address,
      ownerAddressToAddOrRemove: unspendableAddress,
      chainId,
      threshold: 1,
      signer: privateKey
    });

    const pkAccount = privateKeyToAccount(privateKey);

    this.logger.log(`Removing owner address: ${pkAccount.address}`);

    await this.configSafeService.removeSafeOwner({
      safeAddress: smartAccountClient.account!.address,
      ownerAddressToAddOrRemove: pkAccount.address,
      chainId,
      threshold: 1,
      signer: privateKey
    });

    const owners = await this.configSafeService.getSafeOwners(chainId, smartAccountClient.account!.address as Hex);

    if (owners[0].toLowerCase() !== unspendableAddress.toLowerCase() || owners.length !== 1) {
      this.logger.warn('Safe setup failed');  
    } else {
      this.logger.log('Safe setup successful');
    }

    
  }
} 
