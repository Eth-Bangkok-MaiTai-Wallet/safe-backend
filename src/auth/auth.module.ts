import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { PasskeyService } from './passkey.service.js';
import { SiweService } from './siwe.service.js';
import { ConfigModule } from '@nestjs/config';
import { ConfigSafeService } from '../safe/config.safe.service.js';
import { RpcService } from '../rpc/rpc.service.js';

@Module({
  imports: [ConfigModule],
  controllers: [AuthController],
  providers: [
    PasskeyService, 
    SiweService,
    ConfigSafeService,
    RpcService
  ],
  exports: [PasskeyService, SiweService]
})
export class AuthModule {} 