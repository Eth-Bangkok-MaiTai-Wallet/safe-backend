import { Logger } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Hex, http, parseEventLogs, PublicClient } from 'viem';
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

    this.logger.log('Creating smart account client');
    const { smartAccountClient, privateKey } = await this.rpcService.createSmartAccountClient(chainId);
    const publicClient = this.rpcService.getPublicClient(chainId);
    const pimlicoClient = this.rpcService.getPimlicoClient(chainId);

    this.logger.log(`Smart account client: ${JSON.stringify(smartAccountClient.account)}`);

    // this.logger.log('Getting ownable validator owners');
    // const owners = await getOwnableValidatorOwners({
    //   client: publicClient as PublicClient,
    //   account: {
    //     address: smartAccountClient.account!.address,
    //     deployedOnChains: [chainId],
    //     type: 'safe',
    //   },
    // });

    // this.logger.log(`Ownable validator owners: ${JSON.stringify(owners)}`);


    const account = getAccount({
      address: smartAccountClient.account!.address,
      type: 'safe',
    });

    await this.erc7579SafeService.installOwnableValidatorModule(smartAccountClient, [ownerAddress], 1);

    const safeOwners = await this.getOwners(publicClient, smartAccountClient);
    this.logger.warn(`Safe owners: ${JSON.stringify(safeOwners)}`);

    // const receipt = await this.writeGreeter(smartAccountClient, pluginAssignedOwner, publicClient, pimlicoClient, account, ownableValidatorModule);
    // await this.parseUserOpLogs(receipt, pimlicoClient);

    // await this.addOwner(smartAccountClient, pluginAssignedOwner, publicClient, pimlicoClient, '0xb0754B937bD306fE72264274A61BC03F43FB685F', account, ownableValidatorModule);

    // Read the owners after removal
    // const updatedOwners = await this.getOwners(publicClient, smartAccountClient);
    // this.logger.warn('Updated owners after adding:', updatedOwners);

    // await this.writeGreeter(smartAccountClient, pluginAssignedOwner, publicClient, pimlicoClient, account, ownableValidatorModule);

    // await this.fundSafe(publicClient, smartAccountClient);

    await this.configSafeService.removeSafeOwner(smartAccountClient.account!.address, '0xb0754B937bD306fE72264274A61BC03F43FB685F', chainId);

    const removedOwners = await this.getOwners(publicClient, smartAccountClient);
    this.logger.warn('Removed owners after removal:', removedOwners);
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
    });

    const { userOperation, userOpHashToSign } = await this.transactSafeService.prepareUserOperation(
      {
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
      },
      smartAccountClient,
    );

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
} 
