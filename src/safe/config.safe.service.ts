import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { encodeValidatorNonce, Module } from '@rhinestone/module-sdk';
import { createSafeClient } from '@safe-global/sdk-starter-kit';
import { getAccountNonce } from 'permissionless/actions';
import { RpcService } from '../rpc/rpc.service.js';
import { safeAbi } from '../utils/abi/safe.abi.js';
import { Hex } from 'viem';
import { entryPoint07Address } from 'viem/account-abstraction';
import { TransactSafeService } from './transact.safe.service.js';
import { SafeSigner } from '@safe-global/protocol-kit';
import { privateKeyToAccount } from 'viem/accounts';
import { SafeOwnerConfig } from './Typres.js';
// necessary imports

interface GetAccountNonceArgs {
  address: Hex;
  entryPointAddress: Hex;
  key?: bigint;
}

@Injectable()
export class ConfigSafeService {

  private readonly logger = new Logger(ConfigSafeService.name);

  constructor(
    private configService: ConfigService,
    private rpcService: RpcService,
    private transactSafeService: TransactSafeService,
  ) {}
  
  async configSafe(data: any) {
    // Logic to install ERC7579 modules into the Safe using permissionlessjs
    // Read which modules are installed
    // Configure the installed modules

    // ...
  }

  // Can only be done via Safe transaction (direct call to Safe contract, not possible via user operation)
  async removeSafeOwner(config: SafeOwnerConfig) {
    
    const safeClient = await createSafeClient({
      provider: this.rpcService.getRpcUrl(config.chainId),
      signer: config.signer ? config.signer : this.configService.get('PRIVATE_KEY') as Hex,
      safeAddress: config.safeAddress,
    })

    const transaction = await safeClient.createRemoveOwnerTransaction({
      ownerAddress: config.ownerAddressToAddOrRemove,
      threshold: config.threshold ? config.threshold : 1
    })
    
    const txResult = await safeClient.send({
      transactions: [transaction]
    })

    await new Promise(resolve => setTimeout(resolve, 20000));

    this.logger.log(`safe remove owner tx result ${txResult}`)

    return txResult;
  }

  async addSafeOwner(config: SafeOwnerConfig) {
    
    const safeClient = await createSafeClient({
      provider: this.rpcService.getRpcUrl(config.chainId),
      signer: config.signer ? config.signer : this.configService.get('PRIVATE_KEY') as Hex,
      safeAddress: config.safeAddress,
    })

    const transaction = await safeClient.createAddOwnerTransaction({
      ownerAddress: config.ownerAddressToAddOrRemove,
      threshold: config.threshold ? config.threshold : 1
    })
    
    const txResult = await safeClient.send({
      transactions: [transaction]
    })

    await new Promise(resolve => setTimeout(resolve, 20000));

    this.logger.log(`safe add owner tx result ${txResult}`)

    return txResult;
  }

  // Adds a safe owner via user operation, i.e. can be gas sponsored
  // Returns the user operation and the hash to sign but does not execute it
  // Example how to execute:
  // userOperation.signature = await pkAccount.signMessage({
  //   message: { raw: userOpHashToSign },
  // })
  // const userOpHash = await smartAccountClient.sendUserOperation(userOperation);
  // const receipt = await pimlicoClient.waitForUserOperationReceipt({
  //   hash: userOpHash,
  // })
  async addSafeOwnerUserOp(smartAccountClient, ownerAddressToAdd: Hex, validatorModule: Module | null = null) {

    const publicClient = this.rpcService.getPublicClient(smartAccountClient.chain.id);

    const getAccountNonceArgs: GetAccountNonceArgs = {
      address: smartAccountClient.account!.address,
      entryPointAddress: entryPoint07Address,
    }

    if (validatorModule) {
      getAccountNonceArgs.key = encodeValidatorNonce({ account: smartAccountClient.account!, validator: validatorModule as Module });
    }

    const nonce = await getAccountNonce(publicClient, getAccountNonceArgs);

    const {userOperation, userOpHashToSign} = await this.transactSafeService.prepareUserOperation({
      nonce: nonce.toString(),
      calls: [
        {
          to: smartAccountClient.account!.address,
          functionName: 'addOwnerWithThreshold',
          abi: safeAbi,
          args: [ownerAddressToAdd, 1],
        },
      ],
    }, smartAccountClient);

    return {
      userOperation,
      userOpHashToSign,
    };
  }

  async getSafeOwners(chainId: number, safeAddress: Hex) {
    this.logger.log(`Calling getOwners function on safe contract`);

    const publicClient = this.rpcService.getPublicClient(chainId);

    const safeOwners = await publicClient.readContract({
      address: safeAddress,
      abi: safeAbi,
      functionName: 'getOwners',
    }) as Hex[];

    return safeOwners;
  }

  async signWithPk(message: Hex) {
    const pkAccount = privateKeyToAccount(this.configService.get('PRIVATE_KEY') as Hex);
    return await pkAccount.signMessage({
      message: { raw: message },
    })
  }
} 

