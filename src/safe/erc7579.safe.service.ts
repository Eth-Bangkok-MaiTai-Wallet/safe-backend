import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// import { getOwnableValidator, getOwnableValidatorOwners, getSmartSessionsValidator } from '@rhinestone/module-sdk';
import { RpcService } from '../rpc/rpc.service.js';
import { Address, Client, Hex, PublicClient, toBytes, toHex } from 'viem';
import { PasskeyDto } from './safe.dtos.js';
import { PublicKey } from "ox";
import { getWebAuthnValidator } from '@rhinestone/module-sdk';
import { generatePrivateKey } from 'viem/accounts';
import { privateKeyToAccount } from 'viem/accounts';
import { SafeSessionConfig } from '../user/schemas/safe.schema.js';
import {
  getSmartSessionsValidator,
  OWNABLE_VALIDATOR_ADDRESS,
  getSudoPolicy,
  Session,
  getAccount,
  encodeSmartSessionSignature,
  getOwnableValidatorMockSignature,
  RHINESTONE_ATTESTER_ADDRESS,
  MOCK_ATTESTER_ADDRESS,
  encodeValidatorNonce,
  getOwnableValidator,
  encodeValidationData,
  getEnableSessionDetails,
} from '@rhinestone/module-sdk'
import { User } from '../user/schemas/user.schema.js';
// necessary imports

@Injectable()
export class Erc7579SafeService {

  private readonly logger = new Logger(Erc7579SafeService.name);

  private stateStore = new Map<Hex, any>();

  constructor(
    private configService: ConfigService,
    private rpcService: RpcService,
  ) {}

  createState(hash: Hex, obj: any): string {
    this.logger.verbose('createState Key', hash);
    this.stateStore.set(hash, obj);
    return hash;
  }

  retrieveState(hash: Hex): any {
    const obj = this.stateStore.get(hash);
    this.logger.verbose('retrieveState', obj);
    // this.stateStore.delete(hash);
    return obj;
  }

  deleteState(hash: Hex) {
    this.stateStore.delete(hash);
  }

  async installOwnableValidatorModule(smartAccountClient, owners: Hex[], threshold: number) {

    const pimlicoClient = this.rpcService.getPimlicoClient(smartAccountClient.chain.id);

    // const publicClient = this.rpcService.getPublicClient(smartAccountClient.chain.id);

    const ownableValidatorModule = getOwnableValidator({
        threshold: threshold,
        owners: owners,
    })
      
    this.logger.log(`Installing ownable validator module with threshold ${threshold} and owners ${owners}`);
    const opHash1 = await smartAccountClient.installModule(ownableValidatorModule);

    this.logger.log(`Waiting for user operation receipt for opHash: ${opHash1}`);
    const receipt = await pimlicoClient.waitForUserOperationReceipt({
      hash: opHash1,
    })

    if (receipt.success) {
      this.logger.log('Ownable validator module installed successfully', receipt);
    } else {
      this.logger.error(`Ownable validator module installation failed: ${receipt.reason}`);
      throw new Error(`Ownable validator module installation failed: ${receipt.reason}`);
    }

    // this.logger.log('Getting ownable validator owners after module installation');
    // const owners2 = await getOwnableValidatorOwners({
    //   client: publicClient as PublicClient,
    //   account: {
    //     address: smartAccountClient.account!.address,
    //     deployedOnChains: [publicClient.chain!.id],
    //     type: 'safe',
    //   },
    // });

    // this.logger.warn(`Ownable validator owners after module installation: ${JSON.stringify(owners2)}`);
  }

  async installWebAuthnModule(smartAccountClient, passkeyCredential: PasskeyDto) {

    this.logger.log(`Installing webauthn validator with pubKey: ${passkeyCredential.publicKey} and authenticatorId: ${passkeyCredential.id}`);

    const validator = getWebAuthnValidator({
      pubKey: passkeyCredential.publicKey,
      authenticatorId: passkeyCredential.id,
    });
    
    const installOp = await smartAccountClient.installModule(validator);
    
    const receipt = await smartAccountClient.waitForUserOperationReceipt({
      hash: installOp,
    });

    if (receipt.success) {
      this.logger.log(`webauthn validator installed successfully: ${receipt}`);
    } else {
      this.logger.error(`webauthn validator installation failed: ${receipt}`);
      throw new Error(`webauthn validator installation failed: ${receipt}`);
    }

  }

  async installSessionsModule(smartAccountClient) {

    this.logger.log(`Installing smart sessions validator`);

    const pimlicoClient = this.rpcService.getPimlicoClient(smartAccountClient.chain.id);

    const smartSessions = getSmartSessionsValidator({})
 
    const opHash = await smartAccountClient.installModule(smartSessions)
    
    const receipt = await pimlicoClient.waitForUserOperationReceipt({
      hash: opHash,
    })

    if (receipt.success) {
      this.logger.log(`smart sessions validator installed successfully: ${receipt}`);
    } else {
      this.logger.error(`smart sessions validator installation failed: ${receipt}`);
      throw new Error(`smart sessions validator installation failed: ${receipt}`);
    }
  }

  async installScheduledOrders(smartAccountClient, scheduledOrders: any) {

    this.logger.log(`Installing scheduled orders validator`);
  }

  async configureSession(user: User, safeAddress: Hex, chainId: number, sessionConfig: SafeSessionConfig | null = null, privateKey: Hex | null = null) {

    this.logger.log(`Configuring sessions`);

    const smartAccountClient = await this.rpcService.getSmartAccountClient(chainId, safeAddress);

    const pk = privateKey || generatePrivateKey();

    // const owner = privateKeyToAccount(pk)

    // const ownableValidator = getOwnableValidator({
    //   owners: [owner.address],
    //   threshold: 1,
    // });

    const sessionOwner = privateKeyToAccount(pk)
 
    const session: Session = {
      sessionValidator: OWNABLE_VALIDATOR_ADDRESS,
      sessionValidatorInitData: encodeValidationData({
        threshold: 1,
        owners: [sessionOwner.address],
      }),
      salt: toHex(toBytes('0', { size: 32 })),
      userOpPolicies: [getSudoPolicy()],
      erc7739Policies: {
        allowedERC7739Content: [],
        erc1271Policies: [],
      },
      actions: [
        {
          actionTarget: '0xa564cB165815937967a7d018B7F34B907B52fcFd' as Address, // an address as the target of the session execution
          actionTargetSelector: '0x00000000' as Hex, // function selector to be used in the execution, in this case no function selector is used
          actionPolicies: [getSudoPolicy()],
        },
      ],
      chainId: BigInt(smartAccountClient.chain.id),
      permitERC4337Paymaster: true,
    }

    const publicClient = this.rpcService.getPublicClient(smartAccountClient.chain.id);

    const account = getAccount({
      address: smartAccountClient.account!.address,
      type: 'safe',
    })
     
    const sessionDetails = await getEnableSessionDetails({
      sessions: [session],
      account,
      clients: [publicClient as PublicClient],
    })

    this.logger.verbose(`Session details:`, sessionDetails);

    const hash = this.createState(sessionDetails.permissionEnableHash, sessionDetails);

    const safe = user.safesByChain.find(sbc => sbc.chainId === chainId)?.safes.find(s => s.safeAddress === safeAddress);

    if (!safe) {
      throw new Error('Safe not found');
    }

    safe.safeModuleSessionConfig?.push({
      sessionKey: pk,
      sessionConfigHash: hash,
    });

    await user.save();

    return {hash};

    // const config = sessionConfig || {
    //   owner: owner.address,
    //   threshold: 1,
    //   owners: [owner.address],
    // }


    // const opHash = await smartAccountClient.installModule(sessionConfig)
    
    


    // const sessionConfig = {
    //   owner: owner.address,
    //   threshold: 1,
    //   owners: [owner.address],
    // }
  }
} 
