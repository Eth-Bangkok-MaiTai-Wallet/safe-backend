import { Injectable } from '@nestjs/common';
import { Client, createPublicClient, getContract, http } from 'viem';
import { mainnet, sepolia } from 'viem/chains';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { toSafeSmartAccount } from 'permissionless/accounts';
import {
  createBundlerClient,
  entryPoint07Address,
} from 'viem/account-abstraction';
import { createSmartAccountClient } from 'permissionless';
import { ConfigService } from '@nestjs/config';
// import { getAddress, maxUint256, parseAbi } from 'viem';
// import { EntryPointVersion } from 'viem/account-abstraction';

// import { encodeFunctionData, parseAbiItem } from 'viem';

@Injectable()
export class AppService {

  constructor(private configService: ConfigService) {}

  async getHello(): Promise<string> {
    // const blockNumber = await this.getBlockNumber();

    return await this.sendUserOperation();
  }

  async getBlockNumber() {
    const client = createPublicClient({
      chain: mainnet,
      transport: http(),
    });

    const blockNumber = await client.getBlockNumber();
    console.log(blockNumber);
    return blockNumber;
  }

  async sendUserOperation() {
    const apiKey = this.configService.get('PIMLICO_API_KEY');
    if (!apiKey) throw new Error('Missing PIMLICO_API_KEY');

    const privateKey = generatePrivateKey();

    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http('https://rpc.ankr.com/eth_sepolia'),
    });

    const pimlicoUrl = `https://api.pimlico.io/v2/sepolia/rpc?apikey=${apiKey}`;

    const pimlicoClient = createPimlicoClient({
      transport: http(pimlicoUrl),
      entryPoint: {
        address: entryPoint07Address,
        version: '0.7',
      },
    });

    const account = await toSafeSmartAccount({
      client: publicClient,
      owners: [privateKeyToAccount(privateKey)],
      entryPoint: {
        address: entryPoint07Address,
        version: '0.7',
      }, // global entrypoint
      version: '1.4.1',
    });

    console.log(
      `Smart account address: https://sepolia.etherscan.io/address/${account.address}`,
    );

    const encodedCalls = await account.encodeCalls([
      {
        to: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
        value: 10000000000n,
      },
    ]);


    const smartAccountClient = createSmartAccountClient({
      account,
      chain: sepolia,
      bundlerTransport: http(pimlicoUrl),
      paymaster: pimlicoClient,
      userOperation: {
        estimateFeesPerGas: async () => {
          return (await pimlicoClient.getUserOperationGasPrice()).fast;
        },
      },
    });

    const txHash = await smartAccountClient.sendTransaction({
      account,
      to: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
      value: 10000000000n,
      // data: '0x1234',
      // kzg: undefined,
      // chain: sepolia,
    });

    console.log(
      `User operation included: https://sepolia.etherscan.io/tx/${txHash}`,
    );

    return `User operation included: https://sepolia.etherscan.io/tx/${txHash}`;
  }

  async sendUserOperation2() {
    const apiKey = this.configService.get('PIMLICO_API_KEY');
    if (!apiKey) throw new Error('Missing PIMLICO_API_KEY');

    const privateKey = generatePrivateKey();

    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http('https://rpc.ankr.com/eth_sepolia'),
    });

    const account = await toSafeSmartAccount({
      client: publicClient as Client,
      owners: [privateKeyToAccount(privateKey)],
      entryPoint: {
        address: entryPoint07Address,
        version: '0.7',
      }, // global entrypoint
      version: '1.4.1',
    });

    console.log({
      accountAddress: await account.getAddress(),
    });

    console.log(
      `Smart account address: https://sepolia.etherscan.io/address/${account.address}`,
    );

    const pimlicoUrl = `https://api.pimlico.io/v2/sepolia/rpc?apikey=${apiKey}`;

    const pimlicoClient = createPimlicoClient({
      transport: http(pimlicoUrl),
      entryPoint: {
        address: entryPoint07Address,
        version: '0.7',
      },
    });

    {
      const smartAccountClient = createSmartAccountClient({
        account,
        chain: sepolia,
        bundlerTransport: http(pimlicoUrl),
        paymaster: pimlicoClient,
        userOperation: {
          estimateFeesPerGas: async () => {
            return (await pimlicoClient.getUserOperationGasPrice()).fast;
          },
        },
      });

      const txHash = await smartAccountClient.sendTransaction({
        to: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
        value: 0n,
        data: '0x1234',
      });

      console.log(
        `User operation with single transaction included: https://sepolia.etherscan.io/tx/${txHash}`,
      );

      const contract = getContract({
        address: '0x6D7A849791a8E869892f11E01c2A5f3b25a497B6',
        abi: [
          {
            inputs: [],
            name: 'getLastGreeter',
            outputs: [{ internalType: 'address', name: '', type: 'address' }],
            stateMutability: 'view',
            type: 'function',
          },
          {
            inputs: [],
            name: 'greet',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
        ],
        client: {
          public: publicClient,
          wallet: smartAccountClient,
        },
      });

      const txHash2 = await contract.write.greet();

      console.log(
        `User operation with contract call included: https://sepolia.etherscan.io/tx/${txHash2}`,
      );

      const txHashMultiple = await smartAccountClient.sendTransaction({
        calls: [
          {
            to: '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc',
            value: 0n,
            data: '0x1234',
          },
          {
            abi: [
              {
                inputs: [],
                name: 'getLastGreeter',
                outputs: [
                  { internalType: 'address', name: '', type: 'address' },
                ],
                stateMutability: 'view',
                type: 'function',
              },
              {
                inputs: [],
                name: 'greet',
                outputs: [],
                stateMutability: 'nonpayable',
                type: 'function',
              },
            ],
            functionName: 'greet',
            args: [],
            to: '0x6D7A849791a8E869892f11E01c2A5f3b25a497B6',
          },
        ],
      });

      console.log(
        `User operation with multiple transactions included: https://sepolia.etherscan.io/tx/${txHashMultiple}`,
      );
    }

    {
      const bundlerClient = createBundlerClient({
        account,
        chain: sepolia,
        transport: http(pimlicoUrl),
        paymaster: pimlicoClient,
        userOperation: {
          estimateFeesPerGas: async () => {
            return (await pimlicoClient.getUserOperationGasPrice()).fast;
          },
        },
      });

      const userOpHash = await bundlerClient.sendUserOperation({
        calls: [
          {
            to: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
            value: 0n,
            data: '0x1234',
          },
        ],
      });

      const receipt = await bundlerClient.waitForUserOperationReceipt({
        hash: userOpHash,
      });

      console.log(
        `User operation included: https://sepolia.etherscan.io/tx/${receipt.receipt.transactionHash}`,
      );

      // const txHashMultiple = await bundlerClient.sendUserOperation({
      //   calls: [
      //     // {
      //     //   to: '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc',
      //     //   value: 0n,
      //     //   data: '0x1234',
      //     // },
      //     {
      //       to: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
      //       value: 0n,
      //       data: '0x1234',
      //     },
      //     {
      //       abi: [
      //         {
      //           inputs: [],
      //           name: 'getLastGreeter',
      //           outputs: [
      //             { internalType: 'address', name: '', type: 'address' },
      //           ],
      //           stateMutability: 'view',
      //           type: 'function',
      //         },
      //         {
      //           inputs: [],
      //           name: 'greet',
      //           outputs: [],
      //           stateMutability: 'nonpayable',
      //           type: 'function',
      //         },
      //       ],
      //       functionName: 'greet',
      //       args: [],
      //       to: '0x6D7A849791a8E869892f11E01c2A5f3b25a497B6',
      //     },
      //   ],
      // });

      // const receipt2 = await bundlerClient.getUserOperationReceipt({
      //   hash: txHashMultiple,
      // });

      // console.log(
      //   `User operation included: https://sepolia.etherscan.io/tx/${receipt2.receipt.transactionHash}`,
      // );
    }

    return 'done';
  }
}
