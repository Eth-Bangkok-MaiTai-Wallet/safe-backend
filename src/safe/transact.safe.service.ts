import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { encodeFunctionData, Hex } from 'viem';
import { getChainSlug } from '../utils/pimlico.js';
import { RpcService } from '../rpc/rpc.service.js';
import { TransactSafeDto, UserOperationDto } from './safe.dtos.js';
import { SmartAccountClient } from 'permissionless';
import { getContractABI } from '../utils/etherscan.js';
import { entryPoint07Address } from 'viem/account-abstraction';
import { getUserOperationHash } from 'viem/account-abstraction';


@Injectable()
export class TransactSafeService {
  constructor(
    private configService: ConfigService,
    private rpcService: RpcService,
  ) {}

  async transactSafe(address: Hex, chainId: number, data: TransactSafeDto) {
    const apiKey = this.configService.get('PIMLICO_API_KEY');
    if (!apiKey) throw new Error('Missing PIMLICO_API_KEY');

    const chainSlug = getChainSlug(chainId);
    if (!chainSlug) throw new Error('Unsupported chain');

    const {smartAccountClient, privateKey} = await this.rpcService.createSmartAccountClient(
      chainId,
    );

    const txHashMultiple = await smartAccountClient.sendTransaction({
      calls: data.calls,
    });

    console.log(
      `User operation with multiple transactions included: https://sepolia.etherscan.io/tx/${txHashMultiple}`,
    );

    const pimlicoClient = this.rpcService.getPimlicoClient(chainId);

    const receipt = await pimlicoClient.waitForUserOperationReceipt({
      hash: txHashMultiple,
    });

    console.log(receipt);

    return txHashMultiple;
  }

  async prepareUserOperation(userOperationDto: UserOperationDto, smartAccountClient: any) {
    const calls = await Promise.all(
      userOperationDto.calls.map(async (call) => {
        let abi = call.abi;
        if (!abi) {
          try {
            abi = await getContractABI(call.to);
            await new Promise((resolve) => setTimeout(resolve, 1000));
          } catch (error) {
            throw new Error(`Failed to fetch ABI for contract ${call.to}: ${error}`);
          }
        }

        return {
          to: call.to,
          data: encodeFunctionData({
            abi: abi ? abi : [],
            functionName: call.functionName,
            args: call.args,
          }),
        };
      })
    );

    const userOperation = await smartAccountClient.prepareUserOperation({
      account: smartAccountClient.account!,
      calls: calls,
      nonce: BigInt(userOperationDto.nonce),
    });

    const userOpHashToSign = getUserOperationHash({
      chainId: smartAccountClient.chain.id,
      entryPointAddress: entryPoint07Address,
      entryPointVersion: '0.7',
      userOperation,
    })

    return {userOperation, userOpHashToSign};
  }
} 
