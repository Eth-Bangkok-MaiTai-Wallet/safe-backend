import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { SafeModule } from './safe/safe.module.js';

@Module({
  imports: [ConfigModule.forRoot(), SafeModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {} 