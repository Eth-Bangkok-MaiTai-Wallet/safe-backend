import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DCASchedule } from './dca.entity.js';
import { DCAController } from './dca.controller.js';
import { DCAService } from './dca.service.js';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    TypeOrmModule.forFeature([DCASchedule]),
    ScheduleModule.forRoot(),
  ],
  controllers: [DCAController],
  providers: [DCAService],
  exports: [DCAService],
})
export class DCAModule {}