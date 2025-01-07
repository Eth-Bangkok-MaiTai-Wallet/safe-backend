import { Logger } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { encodeAbiParameters, encodePacked, Hex, http, keccak256, parseEventLogs, PublicClient, Transport, verifyMessage } from 'viem';
import { RpcService } from '../rpc/rpc.service.js';
import { encodeValidatorNonce, getAccount, getOwnableValidator, getOwnableValidatorOwners, SMART_SESSIONS_ADDRESS } from '@rhinestone/module-sdk';
import { privateKeyToAccount } from 'viem/accounts';
import { entryPoint07Address, getUserOperationHash } from 'viem/account-abstraction';
import { getAccountNonce } from 'permissionless/actions';
import { TransactSafeService } from './transact.safe.service.js';
import { getContractABI } from '../utils/etherscan.js';
import { createWalletClient } from 'viem';
import Safe from '@safe-global/protocol-kit'
import { MetaTransactionData } from '@safe-global/safe-core-sdk-types'
import SafeApiKit from '@safe-global/api-kit'
import { createSafeClient } from '@safe-global/sdk-starter-kit'
import { safeAbi } from '../utils/abi/safe.abi.js';

@Injectable()
export class InitSafeService {
  private readonly logger = new Logger(InitSafeService.name);

  constructor(
    private configService: ConfigService,
    private rpcService: RpcService,
    private transactSafeService: TransactSafeService,
  ) {}

  async initSafe(data: { ownerAddress: `0x${string}`, chainId: number }) {
    this.logger.log(`Initializing safe for owner address: ${data.ownerAddress} on chain ID: ${data.chainId}`);

    const apiKey = this.configService.get('PIMLICO_API_KEY');
    if (!apiKey) throw new Error('Missing PIMLICO_API_KEY');

    this.logger.log('Creating smart account client');
    const {smartAccountClient, privateKey} = await this.rpcService.createSmartAccountClient(
      data.chainId,
    );

    this.logger.log('Getting public client');
    const publicClient = this.rpcService.getPublicClient(data.chainId);

    this.logger.log('Getting Pimlico client');
    const pimlicoClient = this.rpcService.getPimlicoClient(data.chainId);

    this.logger.log('Getting ownable validator owners');
    const owners = await getOwnableValidatorOwners({
      client: publicClient as PublicClient,
      account: {
        address: smartAccountClient.account!.address,
        deployedOnChains: [publicClient.chain!.id],
        type: 'safe',
      },
    });

    this.logger.log(`Ownable validator owners: ${JSON.stringify(owners)}`);

    const ownableValidatorModule = getOwnableValidator({
      threshold: 1,
      owners: [data.ownerAddress],
    })

    this.logger.log(`Smart account client: ${JSON.stringify(smartAccountClient.account)}`);

    const account = getAccount({
      address: smartAccountClient.account!.address,
      type: 'safe',
    })

    this.logger.log(`Account: ${JSON.stringify(account)}`);

    await this.installOwnableValidator(smartAccountClient, ownableValidatorModule, pimlicoClient, publicClient, account);

    const safeOwners = await this.getOwners(publicClient, smartAccountClient);
    this.logger.warn(`Safe owners: ${JSON.stringify(safeOwners)}`);

    const pluginAssignedOwner = privateKeyToAccount(
      this.configService.get('PRIVATE_KEY') as Hex,
    )

    const receipt = await this.writeGreeter(smartAccountClient, pluginAssignedOwner, publicClient, pimlicoClient, account, ownableValidatorModule);

    await this.parseUserOpLogs(receipt, pimlicoClient);

    await this.addOwner(smartAccountClient, pluginAssignedOwner, publicClient, pimlicoClient, '0xb0754B937bD306fE72264274A61BC03F43FB685F', account, ownableValidatorModule)

    // Read the owners after removal
    const updatedOwners = await this.getOwners(publicClient, smartAccountClient);
    this.logger.warn('Updated owners after adding:', updatedOwners);

    await this.writeGreeter(smartAccountClient, pluginAssignedOwner, publicClient, pimlicoClient, account, ownableValidatorModule);

    // await this.fundSafe(publicClient, smartAccountClient);

    await this.removeOwnerWithSafeClient(smartAccountClient, publicClient);

    const removedOwners = await this.getOwners(publicClient, smartAccountClient);
    this.logger.warn('Removed owners after removal:', removedOwners);
  }

  async installOwnableValidator(smartAccountClient, ownableValidatorModule, pimlicoClient, publicClient, account) {
    this.logger.log('Installing ownable validator module');
    const opHash1 = await smartAccountClient.installModule(ownableValidatorModule);

    this.logger.log(`Waiting for user operation receipt for opHash: ${opHash1}`);
    await pimlicoClient.waitForUserOperationReceipt({
      hash: opHash1,
    })

    this.logger.log('Getting ownable validator owners after module installation');
    const owners2 = await getOwnableValidatorOwners({
      client: publicClient as PublicClient,
      account: {
        address: smartAccountClient.account!.address,
        deployedOnChains: [publicClient.chain!.id],
        type: 'safe',
      },
    });

    this.logger.warn(`Ownable validator owners after module installation: ${JSON.stringify(owners2)}`);
  }

  async getOwners(publicClient, smartAccountClient) {
    this.logger.log(`Calling getOwners function on safe contract`);

    const safeOwners = await publicClient.readContract({
      address: smartAccountClient.account!.address,
      abi: safeAbi,
      functionName: 'getOwners',
    }) as Hex[];

    return safeOwners;
  }

  async writeGreeter(smartAccountClient, pluginAssignedOwner, publicClient, pimlicoClient, account, ownableValidatorModule) {
    const nonce = await getAccountNonce(publicClient, {
      address: smartAccountClient.account!.address,
      entryPointAddress: entryPoint07Address,
      key: encodeValidatorNonce({ account, validator: ownableValidatorModule }),
    })

    this.logger.log(`Account nonce: ${nonce}`);

    const {userOperation, userOpHashToSign} = await this.transactSafeService.prepareUserOperation({
      nonce: nonce.toString(),
      calls: [
        {
          to: '0x6D7A849791a8E869892f11E01c2A5f3b25a497B6',
          functionName: 'greet',
          abi: [
            {
              inputs: [],
              name: 'greet',
              outputs: [],
              stateMutability: 'nonpayable',
              type: 'function',
            },
          ],
          args: [],
        },
      ],
    }, smartAccountClient);
     
    userOperation.signature = await pluginAssignedOwner.signMessage({
      message: { raw: userOpHashToSign },
    })

    const userOpHash = await smartAccountClient.sendUserOperation(userOperation)

    this.logger.log(`User operation hash: ${userOpHash}`);
 
    const receipt = await pimlicoClient.waitForUserOperationReceipt({
      hash: userOpHash,
    })

    this.logger.warn(`User operation receipt: ${receipt.success}`);
    this.logger.warn(`User operation receipt: ${receipt.receipt.logs}`);

    return receipt;
  }

  async parseUserOpLogs(receipt, pimlicoClient) {
    const uniqueAddresses = new Set<string>();

    receipt.receipt.logs.forEach((log) => {
      uniqueAddresses.add(log.address);
    });

    const abiMap: Record<string, any[]> = {};

    for (const contractAddress of uniqueAddresses) {
      try {
        const abi = await getContractABI(contractAddress);
        abiMap[contractAddress] = abi;
      } catch (error) {
        console.error('Error fetching ABI for Contract', contractAddress);
        console.error(error);
      }
    }

    receipt.receipt.logs.forEach((log) => {
      const contractAddress = log.address;
      const contractAbi = abiMap[contractAddress];

      if (contractAbi) {
        try {
          const parsedLogs = parseEventLogs({
            abi: contractAbi,
            logs: [log],
          });

          console.log('Parsed Logs for Contract', contractAddress);
          console.log(parsedLogs);
        } catch (error) {
          console.error('Error parsing logs for Contract', contractAddress);
          console.error(error);
        }
      } else {
        console.warn('No ABI found for Contract', contractAddress);
      }
    });
  }

  async addOwner(smartAccountClient, pluginAssignedOwner, publicClient, pimlicoClient, owner, account, ownableValidatorModule) {
    const nonceR = await getAccountNonce(publicClient, {
      address: smartAccountClient.account!.address,
      entryPointAddress: entryPoint07Address,
      key: encodeValidatorNonce({ account, validator: ownableValidatorModule }),
    });

    const {userOperation: userOperationR, userOpHashToSign: userOpHashToSignR} = await this.transactSafeService.prepareUserOperation({
      nonce: nonceR.toString(),
      calls: [
        {
          to: smartAccountClient.account!.address,
          functionName: 'addOwnerWithThreshold',
          abi: safeAbi,
          args: [owner, 1],
        },
      ],
    }, smartAccountClient);

    userOperationR.signature = await pluginAssignedOwner.signMessage({
      message: { raw: userOpHashToSignR },
    })

    const userOpHashR = await smartAccountClient.sendUserOperation(userOperationR);

    const receiptR = await pimlicoClient.waitForUserOperationReceipt({
      hash: userOpHashR,
    })

    this.logger.warn(`User operation receipt for adding owner: ${receiptR.success}`);
    this.logger.log(`Added owner ${owner} to the safe wallet. Transaction hash: ${userOpHashR}`);
  }

  // async removeOwner(smartAccountClient, pluginAssignedOwner, publicClient, pimlicoClient, owner, account, ownableValidatorModule) {
  //   try {
  //     await this.addOwner(smartAccountClient, pluginAssignedOwner, publicClient, pimlicoClient, '0xb0754B937bD306fE72264274A61BC03F43FB685F', account, ownableValidatorModule);

  //     const nonceR2 = await getAccountNonce(publicClient, {
  //       address: smartAccountClient.account!.address,
  //       entryPointAddress: entryPoint07Address,
  //       key: encodeValidatorNonce({ account, validator: ownableValidatorModule }),
  //     });

  //     const {userOperation: userOperationR2, userOpHashToSign: userOpHashToSignR2} = await this.transactSafeService.prepareUserOperation({
  //       nonce: nonceR2.toString(),
  //       calls: [
  //         {
  //           to: smartAccountClient.account!.address,
  //           functionName: 'removeOwner',
  //           abi: safeAbi,
  //           args: ['0xb0754B937bD306fE72264274A61BC03F43FB685F', '0xb0754B937bD306fE72264274A61BC03F43FB685F', 1],
  //         },
  //       ],
  //     }, smartAccountClient);

  //     userOperationR2.signature = await pluginAssignedOwner.signMessage({
  //       message: { raw: userOpHashToSignR2 },
  //     })

  //     const userOpHashR2 = await smartAccountClient.sendUserOperation(userOperationR2);

  //     const receiptR2 = await pimlicoClient.waitForUserOperationReceipt({
  //       hash: userOpHashR2,
  //     })

  //     this.logger.warn(`User operation receipt for removing owner: ${receiptR2.success}`);
  //     this.logger.log(`Removed owner ${owner} from the safe wallet. Transaction hash: ${userOpHashR2}`);
  //   } catch (error) {
  //     this.logger.error(`Error removing owner ${owner} from the safe wallet`);
  //     this.logger.error(error);
  //   }
  // }

  async fundSafe(publicClient, smartAccountClient) {
    const walletClient = createWalletClient({
      account: privateKeyToAccount(this.configService.get('PRIVATE_KEY') as Hex),
      chain: publicClient.chain,
      transport: http(publicClient.transport.url),
    });

    const tx = await walletClient.sendTransaction({
      to: smartAccountClient.account!.address,
      value: BigInt(0.01 * 10**18),
      data: "0x",
      chain: publicClient.chain,
    })

    const receiptTx = await publicClient.waitForTransactionReceipt({
      hash: tx,
    })

    this.logger.log(`Transaction ETH sent: ${tx}`);
    this.logger.warn(`Eth tx receipt: ${receiptTx.status}`);
  }

  async removeOwnerWithSafeClient(smartAccountClient, publicClient) {
    const safeClient = await createSafeClient({
      provider: publicClient.transport.url,
      signer: this.configService.get('PRIVATE_KEY') as Hex,
      safeAddress: smartAccountClient.account!.address,
    })

    const transaction = await safeClient.createRemoveOwnerTransaction({
      ownerAddress: '0xb0754B937bD306fE72264274A61BC03F43FB685F',
      threshold: 1
    })
    
    const txResult = await safeClient.send({
      transactions: [transaction]
    })

    this.logger.log(`safe remove owner tx result ${txResult}`)

    await new Promise(resolve => setTimeout(resolve, 20000));
  }
} 
