import { Module } from '@nestjs/common';
import { InitSafeService } from './init.safe.service.js';
import { ConfigSafeService } from './config.safe.service.js';
import { TransactSafeService } from './transact.safe.service.js';
import { SafeController } from './safe.controller.js';
import { RpcModule } from '../rpc/rpc.module.js';
import { ConfigModule } from '@nestjs/config';
import { Erc7579SafeService } from './erc7579.safe.service.js';
import { UserModule } from '../user/user.module.js';
@Module({
  imports: [ConfigModule.forRoot(), RpcModule, UserModule],
  providers: [InitSafeService, ConfigSafeService, TransactSafeService, Erc7579SafeService],
  controllers: [SafeController],
})
export class SafeModule {} 