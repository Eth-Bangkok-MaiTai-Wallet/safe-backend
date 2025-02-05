import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DCASchedule } from './dca.entity.js';
import { CreateDCAScheduleDto, UpdateDCAScheduleDto } from './dca.dto.js';
import { ethers } from 'ethers';

@Injectable()
export class DCAService {
  constructor(
    @InjectRepository(DCASchedule)
    private dcaRepository: Repository<DCASchedule>,
  ) {}

  async createSchedule(createDto: CreateDCAScheduleDto): Promise<DCASchedule> {
    const schedule = this.dcaRepository.create({
      ...createDto,
      nextExecutionTime: new Date(Date.now() + createDto.frequency * 1000),
      active: true,
    });

    return this.dcaRepository.save(schedule);
  }

  async getAllSchedules(): Promise<DCASchedule[]> {
    return this.dcaRepository.find();
  }

  async getSchedule(id: number): Promise<DCASchedule> {
    const schedule = await this.dcaRepository.findOne({ where: { id } });
    if (!schedule) {
      throw new NotFoundException(`Schedule #${id} not found`);
    }
    return schedule;
  }

  async updateSchedule(
    id: number,
    updateDto: UpdateDCAScheduleDto,
  ): Promise<DCASchedule> {
    const schedule = await this.getSchedule(id);
    Object.assign(schedule, updateDto);
    
    if (updateDto.frequency) {
      schedule.nextExecutionTime = new Date(Date.now() + updateDto.frequency * 1000);
    }

    return this.dcaRepository.save(schedule);
  }

  async deleteSchedule(id: number): Promise<void> {
    const result = await this.dcaRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Schedule #${id} not found`);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async executeDCAOrders() {
    const now = new Date();
    const pendingSchedules = await this.dcaRepository.find({
      where: {
        active: true,
        nextExecutionTime: LessThanOrEqual(now),
      },
    });

    for (const schedule of pendingSchedules) {
      try {
        await this.executeDCAOrder(schedule);
        
        // Update next execution time
        schedule.lastExecutionTime = now;
        schedule.nextExecutionTime = new Date(now.getTime() + schedule.frequency * 1000);
        schedule.executionCount += 1;
        
        await this.dcaRepository.save(schedule);
      } catch (error) {
        console.error(`Failed to execute DCA order ${schedule.id}:`, error);
        // Implement error handling and notification system here
      }
    }
  }

  private async executeDCAOrder(schedule: DCASchedule) {
    // Implementation of the actual DCA order execution
    // This would interact with your ScheduledOrders smart contract
    // TODO: Implement the actual execution logic
    console.log(`Executing DCA order for schedule ${schedule.id}`);
  }
}