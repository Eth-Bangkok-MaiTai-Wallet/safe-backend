import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getOwnableValidator, getOwnableValidatorOwners } from '@rhinestone/module-sdk';
import { RpcService } from '../rpc/rpc.service.js';
import { Hex, PublicClient } from 'viem';
// necessary imports

@Injectable()
export class Erc7579SafeService {

  private readonly logger = new Logger(Erc7579SafeService.name);

  constructor(
    private configService: ConfigService,
    private rpcService: RpcService,
  ) {}

  async installOwnableValidatorModule(smartAccountClient, owners: Hex[], threshold: number) {

    const pimlicoClient = this.rpcService.getPimlicoClient(smartAccountClient.chain.id);

    const publicClient = this.rpcService.getPublicClient(smartAccountClient.chain.id);

    const ownableValidatorModule = getOwnableValidator({
        threshold: threshold,
        owners: owners,
    })
      
    this.logger.log(`Installing ownable validator module with threshold ${threshold} and owners ${owners}`);
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

} 