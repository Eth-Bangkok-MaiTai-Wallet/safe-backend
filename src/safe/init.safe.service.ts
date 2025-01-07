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

    const safeInterface = {
      abi: [
        {
          inputs: [],
          name: 'getOwners',
          outputs: [
            {
              internalType: 'address[]',
              name: '',
              type: 'address[]',
            },
          ],
          stateMutability: 'view',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'address',
              name: 'prevOwner',
              type: 'address',
            },
            {
              internalType: 'address',
              name: 'owner',
              type: 'address',
            },
            {
              internalType: 'uint256',
              name: '_threshold',
              type: 'uint256',
            },
          ],
          name: 'removeOwner',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'address',
              name: 'owner',
              type: 'address',
            },
            {
              internalType: 'uint256',
              name: '_threshold',
              type: 'uint256',
            },
          ],
          name: 'addOwnerWithThreshold',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
        {
          inputs: [
            {
              internalType: 'address',
              name: 'to',
              type: 'address',
            },
            {
              internalType: 'uint256',
              name: 'value',
              type: 'uint256',
            },
            {
              internalType: 'bytes',
              name: 'data',
              type: 'bytes',
            },
            {
              internalType: 'enum Enum.Operation',
              name: 'operation',
              type: 'uint8',
            },
            {
              internalType: 'uint256',
              name: 'safeTxGas',
              type: 'uint256',
            },
            {
              internalType: 'uint256',
              name: 'baseGas',
              type: 'uint256',
            },
            {
              internalType: 'uint256',
              name: 'gasPrice',
              type: 'uint256',
            },
            {
              internalType: 'address',
              name: 'gasToken',
              type: 'address',
            },
            {
              internalType: 'address',
              name: 'refundReceiver',
              type: 'address',
            },
            {
              internalType: 'bytes',
              name: 'signatures',
              type: 'bytes',
            },
          ],
          name: 'execTransaction',
          outputs: [
            {
              internalType: 'bool',
              name: 'success',
              type: 'bool',
            },
          ],
          stateMutability: 'payable',
          type: 'function',
        },
      ],
    };

    this.logger.log(`Calling getOwners function on safe contract`);

    const safeOwners = await publicClient.readContract({
      address: smartAccountClient.account!.address,
      abi: safeInterface.abi,
      functionName: 'getOwners',
    }) as Hex[];

    this.logger.warn(`Safe owners: ${JSON.stringify(safeOwners)}`);

    const pluginAssignedOwner = privateKeyToAccount(
      this.configService.get('PRIVATE_KEY') as Hex,
    )

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

 

    // Remove all owners from the safe wallet
    for (let i = 0; i < safeOwners.length; i++) {
      const prevOwner = i === 0 ? safeOwners[safeOwners.length - 1] : safeOwners[i - 1];
      const owner = safeOwners[i];

      try {
        // const txHash = await walletClient.writeContract({
        //   address: smartAccountClient.account!.address,
        //   abi: safeInterface.abi,
        //   functionName: 'removeOwner',
        //   args: [owner, owner, 0],
        //   chain: publicClient.chain,
        // });

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
              abi: safeInterface.abi,
              args: ['0xb0754B937bD306fE72264274A61BC03F43FB685F', 1],
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

        this.logger.log(`Removed owner ${owner} from the safe wallet. Transaction hash: ${userOpHashR}`);

        // await new Promise((resolve) => setTimeout(resolve, 10000));

        // const nonceR2 = await getAccountNonce(publicClient, {
        //   address: smartAccountClient.account!.address,
        //   entryPointAddress: entryPoint07Address,
        //   key: encodeValidatorNonce({ account, validator: ownableValidatorModule }),
        // });
    

        // const {userOperation: userOperationR2, userOpHashToSign: userOpHashToSignR2} = await this.transactSafeService.prepareUserOperation({
        //   nonce: nonceR2.toString(),
        //   calls: [
        //     {
        //       to: smartAccountClient.account!.address,
        //       functionName: 'removeOwner',
        //       abi: safeInterface.abi,
        //       args: ['0xb0754B937bD306fE72264274A61BC03F43FB685F', '0xb0754B937bD306fE72264274A61BC03F43FB685F', 1],
        //     },
        //   ],
        // }, smartAccountClient);

        // userOperationR2.signature = await pluginAssignedOwner.signMessage({
        //   message: { raw: userOpHashToSignR2 },
        // })

        // const userOpHashR2 = await smartAccountClient.sendUserOperation(userOperationR2);

        // const receiptR2 = await pimlicoClient.waitForUserOperationReceipt({
        //   hash: userOpHashR2,
        // })

        // this.logger.warn(`User operation receipt for removing owner: ${receiptR2.success}`);
        // this.logger.log(`Removed owner ${owner} from the safe wallet. Transaction hash: ${txHash}`);
      } catch (error) {
        this.logger.error(`Error removing owner ${owner} from the safe wallet`);
        this.logger.error(error);
      }
    }

    // Read the owners after removal
    const updatedOwners = await publicClient.readContract({
      address: smartAccountClient.account!.address,
      abi: safeInterface.abi,
      functionName: 'getOwners',
    }) as Hex[];

    this.logger.warn('Updated owners after removal:', updatedOwners);

    // Repeat the user operation to the greeter contract
    const nonce2 = await getAccountNonce(publicClient, {
      address: smartAccountClient.account!.address,
      entryPointAddress: entryPoint07Address,
      key: encodeValidatorNonce({ account, validator: ownableValidatorModule }),
    });

    this.logger.log(`Account nonce for second user operation: ${nonce2}`);

    const {userOperation: userOperation2, userOpHashToSign: userOpHashToSign2} = await this.transactSafeService.prepareUserOperation({
      nonce: nonce2.toString(),
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

    userOperation2.signature = await pluginAssignedOwner.signMessage({
      message: { raw: userOpHashToSign2 },
    });

    const userOpHash2 = await smartAccountClient.sendUserOperation(userOperation2);

    this.logger.log(`User operation hash for second user operation: ${userOpHash2}`);

    const receipt2 = await pimlicoClient.waitForUserOperationReceipt({
      hash: userOpHash2,
    });

    this.logger.warn(`User operation receipt for second user operation: ${receipt2.success}`);
    this.logger.warn(`User operation receipt for second user operation: ${receipt2.receipt.logs}`);

    const calldata = encodeAbiParameters(
      [
        { type: 'address', name: 'prevOwner' },
        { type: 'address', name: 'owner' },
        { type: 'uint256', name: '_threshold' },
      ],
      ['0xb0754B937bD306fE72264274A61BC03F43FB685F', '0xb0754B937bD306fE72264274A61BC03F43FB685F', BigInt(1)]
    );


    const walletClient = createWalletClient({
      account: privateKeyToAccount(this.configService.get('PRIVATE_KEY') as Hex),
      chain: publicClient.chain,
      transport: http(publicClient.transport.url),
    });

    // Execute a transaction using the safe wallet
    const to = smartAccountClient.account!.address; // Replace with the recipient address
    const value = BigInt(0); // Replace with the value to send (in wei)
    const callData = calldata; // Replace with the data payload
    const operation = BigInt(0); // Replace with the desired operation (0 for CALL, 1 for DELEGATECALL)
    const safeTxGas = BigInt(0); // Replace with the estimated safe transaction gas
    const baseGas = BigInt(0); // Replace with the base gas
    const gasPrice = BigInt(0); // Replace with the gas price (in wei)
    const gasToken = '0x0000000000000000000000000000000000000000'; // Replace with the gas token address (0x0 for ETH)
    const refundReceiver = '0x12bD43589950023a5E20c74064c119D47A55c443'; // Replace with the refund receiver address (0x0 for no refund)
    
    const calldataHash = keccak256(calldata);

    // Sign the calldata hash using the pluginAssignedOwner account
    const signature = await walletClient.signMessage({
      message: { raw: calldataHash },
    });

    // Extract the ECDSA signature components (r, s, v)
    const r = signature.slice(0, 66) as `0x${string}`;
    const s = `0x${signature.slice(66, 130)}` as `0x${string}`;
    const v = parseInt(signature.slice(130, 132), 16);

    // const { r, s, v } = await verifyMessage({
    //   address: walletClient.account.address,
    //   message: calldataHash,
    //   signature,
    // });
    
    // Encode the ECDSA signature components into packed bytes
    const packedSignature = encodePacked(
      ['bytes32', 'bytes32', 'uint8'],
      [r, s, v]
    );

    const signatures = packedSignature; // Replace with the packed signature data

    try {
      const txHash = await walletClient.writeContract({
        address: smartAccountClient.account!.address,
        abi: safeInterface.abi,
        functionName: 'execTransaction',
        args: [to, value, callData, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, signatures],
        chain: publicClient.chain,
        value: value, // Set the value to send with the transaction
      });

      this.logger.log(`Executed transaction using the safe wallet. Transaction hash: ${txHash}`);

      const receipt = await pimlicoClient.waitForUserOperationReceipt({
        hash: txHash,
      })

      this.logger.warn(`User operation receipt for executing transaction: ${receipt.success}`);
    } catch (error) {
      this.logger.error('Error executing transaction using the safe wallet');
      this.logger.error(error);
    }

    // ... code to parse logs and fetch ABIs ...
  }

  
} 
