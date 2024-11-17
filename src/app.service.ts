import { Injectable } from '@nestjs/common';
import { createPublicClient, http } from 'viem';
import { mainnet, sepolia } from 'viem/chains';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { toSafeSmartAccount } from 'permissionless/accounts';
import {
  // createBundlerClient,
  entryPoint07Address,
} from 'viem/account-abstraction';
// import { createSmartAccountClient } from 'permissionless';

@Injectable()
export class AppService {
  async getHello(): Promise<string> {
    const blockNumber = await this.getBlockNumber();
    return blockNumber.toString();
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
    const apiKey = process.env.PIMLICO_API_KEY;
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
  }
}
