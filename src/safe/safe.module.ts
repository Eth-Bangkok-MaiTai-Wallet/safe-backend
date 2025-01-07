import { Module } from '@nestjs/common';
import { InitSafeService } from './init.safe.service.js';
import { ConfigSafeService } from './config.safe.service.js';
import { TransactSafeService } from './transact.safe.service.js';
import { SafeController } from './safe.controller.js';
import { RpcModule } from '../rpc/rpc.module.js';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule.forRoot(), RpcModule],
  providers: [InitSafeService, ConfigSafeService, TransactSafeService],
  controllers: [SafeController],
})
export class SafeModule {} 