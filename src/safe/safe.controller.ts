import { Controller, Post, Body, UseGuards, Logger } from '@nestjs/common';
import { InitSafeService } from './init.safe.service.js';
import { ConfigSafeService } from './config.safe.service.js';
import { TransactSafeService } from './transact.safe.service.js';
import { SafeConfigDto, TransactSafeDto } from './safe.dtos.js';
import { Hex } from 'viem';
import { SessionGuard } from '../auth/session.guard.js';
import { PublicKey, Signature, WebAuthnP256 } from 'ox';
import { SignMetadata } from 'ox/WebAuthnP256';
import { UserService } from '../user/user.service.js';

@Controller('safe')
// @UseGuards(SessionGuard)
export class SafeController {
  private readonly logger = new Logger(SafeController.name);
  
  constructor(
    private readonly initSafeService: InitSafeService,
    private readonly configSafeService: ConfigSafeService,
    private readonly transactSafeService: TransactSafeService,
    private readonly userService: UserService
  ) {}

  @Post('init')
  async initSafe(@Body() data: { ownerAddress: Hex, chainId: number }) {
    return this.initSafeService.initSafeWithOwner(data.ownerAddress, data.chainId);
  }

  @Post('create')
  async configSafe(@Body() config: SafeConfigDto) {
    this.logger.log('creating safe with config:', config);
    return this.configSafeService.configSafe(config);
  }

  @Post('verify-passkey-signer')
  async verifySafe(@Body() data: {metadata: SignMetadata, challenge: Hex, signature: any, credentialId: string}) {

    this.logger.log('Verifying passkey signature');
    this.logger.verbose(data);

    const user = await this.userService.findByPasskeyId(data.credentialId);

    if (!user) {
      throw new Error('User not found');
    }

    const hexKey = user.passkey?.publicKeyHex as Hex;
 
    const publicKey = PublicKey.fromHex(hexKey);

    const result = await WebAuthnP256.verify({ 
      metadata: data.metadata, 
      challenge: data.challenge, 
      publicKey: publicKey, 
      signature: Signature.fromHex(data.signature), 
    })

    this.logger.log(`Result: ${result}`);

    return user;
  }

  @Post('transact')
  async transactSafe(@Body() address: Hex, @Body() chainId: number, @Body() data: TransactSafeDto) {
    return this.transactSafeService.transactSafe(address, chainId, data);
  }
} 