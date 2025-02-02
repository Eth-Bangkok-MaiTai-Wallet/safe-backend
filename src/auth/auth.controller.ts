import { Body, Controller, Post, Get } from '@nestjs/common';
import { PasskeyService } from './passkey.service.js';
import { SiweService } from './siwe.service.js';
import { PasskeyVerifyDto, SiweVerifyDto } from './auth.dtos.js';

@Controller('auth')
export class AuthController {
  constructor(
    private passkeyService: PasskeyService,
    private siweService: SiweService,
  ) {}

  @Get('passkey/challenge')
  async getPasskeyChallenge() {
    return this.passkeyService.generateChallenge();
  }

  @Post('passkey/verify')
  async verifyPasskey(@Body() body: PasskeyVerifyDto) {
    return this.passkeyService.verify(body);
  }

  @Post('ethereum')
  async verifyEthereum(@Body() body: SiweVerifyDto) {
    return this.siweService.verify(body);
  }
} 