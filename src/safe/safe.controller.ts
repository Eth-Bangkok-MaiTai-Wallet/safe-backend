import { Controller, Post, Body, UseGuards, Logger, Req } from '@nestjs/common';
import { InitSafeService } from './init.safe.service.js';
import { ConfigSafeService } from './config.safe.service.js';
import { TransactSafeService } from './transact.safe.service.js';
import { SafeConfigDto, TransactSafeDto, UserOperationCallDto } from './safe.dtos.js';
import { Hex, stringify } from 'viem';
import { SessionGuard } from '../auth/session.guard.js';
import { PublicKey, Signature, WebAuthnP256 } from 'ox';
import { SignMetadata } from 'ox/WebAuthnP256';
import { UserService } from '../user/user.service.js';
import { Transform, Exclude, Expose, Type } from 'class-transformer';
import { Safe } from '../user/schemas/safe.schema.js';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

// class ModifiedSafeConfigDto extends SafeConfigDto {
//   @Exclude()
//   publicKey!: string;

//   @Expose()
//   @Transform(({ value }) => PublicKey.fromHex(value), { toClassOnly: true })
//   @Type(() => PublicKey)
//   publicKey!: PublicKey.PublicKey;
// }

@Controller('safe')
@UseGuards(SessionGuard)
export class SafeController {
  private readonly logger = new Logger(SafeController.name);
  
  constructor(
    private readonly initSafeService: InitSafeService,
    private readonly configSafeService: ConfigSafeService,
    private readonly transactSafeService: TransactSafeService,
    private readonly userService: UserService,
    @InjectModel(Safe.name) private safeModel: Model<Safe>,
  ) {}

  @Post('init')
  async initSafe(@Body() data: { ownerAddress: Hex, chainId: number }) {
    return this.initSafeService.initSafeWithOwner(data.ownerAddress, data.chainId);
  }

  @Post('create')
  async configSafe(@Req() req, @Body() config: SafeConfigDto) {
    this.logger.log('creating safe with config:', config);
    const safes = await this.configSafeService.configSafe(config);

    const userId = req.session.userId;

    if (!userId) {
      throw new Error('User not found');
    }

    const user = await this.userService.findOneByCustomId(userId);
    
    if (user) {
      for (const chainId in safes) {
        const safeAddress = safes[chainId].safeAddress;
        const safeLegacyOwners = safes[chainId].safeLegacyOwners;
        const safeModuleOwners = safes[chainId].safeModuleOwners;
        const safeModulePasskey = safes[chainId].safeModulePasskey;

        const safeData = { safeAddress, chainId: Number(chainId), safeLegacyOwners, safeModuleOwners, safeModulePasskey };
        const safesByChain = user.safesByChain.find(sbc => sbc.chainId === Number(chainId));
        if (safesByChain) {
          safesByChain.safes.push(new this.safeModel(safeData));
        } else {
          user.safesByChain.push({ chainId: Number(chainId), safes: [new this.safeModel(safeData)] });
        }
      }
      await this.userService.updateUser(user);
    }

    return safes;
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

  @Post('create-safe-passkey-user-operation')
  async createSafePasskeyUserOperation(@Req() req, @Body() data: { address: Hex, chainId: number, calls: UserOperationCallDto[], passkeyId: string }) {
    this.logger.log('Creating safe user operation');
    this.logger.verbose(data);

    const userId = req.session.userId;

    if (!userId) {
      throw new Error('User not found');
    }

    const user = await this.userService.findOneByCustomId(userId);

    if (!user) {
      throw new Error('User not found');
    }

    const {userOperation, userOpHashToSign} = await this.transactSafeService.createSafePasskeyUserOperation(user, data.address, data.chainId, data.calls, data.passkeyId);

    return {
      userOperation: stringify(userOperation),
      userOpHashToSign,
    };
  }

  @Post('execute-signed-passkey-user-operation')
  async executeSignedPasskeyTransaction(@Body() data: {  encodedSignature: Hex, userOpHashToSign: Hex, safeAddress: Hex, chainId: number }) {
    this.logger.log('Executing signed passkey transaction');
    // this.logger.verbose(data);

    // this.logger.warn(JSON.stringify(req.session));
    // this.logger.warn(req.sessionID);

    // const user = await this.userService.findOneByCustomId(req.session.userId);

    // if (!user) {
    //   throw new Error('User not found');
    // }

    const result = await this.transactSafeService.executeSignedUserOperation(data.encodedSignature, data.userOpHashToSign, data.safeAddress, data.chainId);

    return result;
  }

  // @Post('transact')
  // async transactSafe(@Body() address: Hex, @Body() chainId: number, @Body() data: TransactSafeDto) {
  //   return this.transactSafeService.transactSafe(address, chainId, data);
  // }
} 