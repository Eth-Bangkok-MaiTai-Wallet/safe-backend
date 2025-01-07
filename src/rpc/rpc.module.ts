import { Module } from '@nestjs/common';
import { RpcService } from './rpc.service.js';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule.forRoot()],
  providers: [RpcService],
  exports: [RpcService],
})
export class RpcModule {} 