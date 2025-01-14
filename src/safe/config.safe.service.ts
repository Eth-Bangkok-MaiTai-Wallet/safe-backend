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

  async removeSafeOwner(safeAddress: Hex, ownerAddressToRemove: Hex, chainId: number, signer: SafeSigner | null = null) {
    
    const safeClient = await createSafeClient({
      provider: this.rpcService.getRpcUrl(chainId),
      signer: signer ? signer : this.configService.get('PRIVATE_KEY') as Hex,
      safeAddress: safeAddress,
    })

    const transaction = await safeClient.createRemoveOwnerTransaction({
      ownerAddress: ownerAddressToRemove,
      threshold: 1
    })
    
    const txResult = await safeClient.send({
      transactions: [transaction]
    })

    await new Promise(resolve => setTimeout(resolve, 20000));

    this.logger.log(`safe remove owner tx result ${txResult}`)
  }

  async addSafeOwner(safeAddress: Hex, ownerAddressToAdd: Hex, chainId: number, signer: SafeSigner | null = null) {
    
    const safeClient = await createSafeClient({
      provider: this.rpcService.getRpcUrl(chainId),
      signer: signer ? signer : this.configService.get('PRIVATE_KEY') as Hex,
      safeAddress: safeAddress,
    })

    const transaction = await safeClient.createAddOwnerTransaction({
      ownerAddress: ownerAddressToAdd,
      threshold: 1
    })
    
    const txResult = await safeClient.send({
      transactions: [transaction]
    })

    await new Promise(resolve => setTimeout(resolve, 20000));

    this.logger.log(`safe add owner tx result ${txResult}`)
  }

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

    // userOperation.signature = await pkAccount.signMessage({
    //   message: { raw: userOpHashToSign },
    // })

    // const userOpHash = await smartAccountClient.sendUserOperation(userOperation);

    // const receipt = await pimlicoClient.waitForUserOperationReceipt({
    //   hash: userOpHash,
    // })

    // this.logger.warn(`User operation receipt for adding owner: ${receipt.success}`);
    // this.logger.log(`Added owner ${owner} to the safe wallet. Transaction hash: ${userOpHash}`);
  }


  async signWithPk(message: Hex) {
    const pkAccount = privateKeyToAccount(this.configService.get('PRIVATE_KEY') as Hex);
    return await pkAccount.signMessage({
      message: { raw: message },
    })
  }
} 

