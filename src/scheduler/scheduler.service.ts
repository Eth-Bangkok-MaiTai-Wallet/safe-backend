// scheduling.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Schedule } from './scheduler.module.js';
import * as cron from 'node-cron';

@Injectable()
export class SchedulingService {
  constructor(
    @InjectRepository(Schedule)
    private readonly scheduleRepository: Repository<Schedule>,
  ) {}

  async createSchedule(schedule: Schedule) {
    const newSchedule = this.scheduleRepository.create(schedule);
    await this.scheduleRepository.save(newSchedule);
    this.scheduleTask(newSchedule);
  }

  async updateSchedule(id: number, schedule: Schedule) {
    const existingSchedule = await this.scheduleRepository.findOne({ where: { id } });
    if (existingSchedule) {
      existingSchedule.frequency = schedule.frequency;
      existingSchedule.interval = schedule.interval;
      await this.scheduleRepository.save(existingSchedule);
      this.scheduleTask(existingSchedule);
    }
  }

  async deleteSchedule(id: number) {
    const schedule = await this.scheduleRepository.findOne({ where: { id } });
    if (schedule) {
      await this.scheduleRepository.delete(id);
      // Cancel the scheduled task
      cron.cancelJob(schedule.id);
    }
  }

  private scheduleTask(schedule: Schedule) {
    const frequency = this.parseFrequency(schedule.frequency);
    cron.scheduleJob(frequency, () => {
      // Execute the task
      console.log(`Executing task ${schedule.name}`);
      // Update the nextExecution and lastExecution fields
      schedule.nextExecution = new Date();
      schedule.lastExecution = new Date();
      this.scheduleRepository.save(schedule);
    });
  }

  private parseFrequency(frequency: string) {
    // Implement frequency parsing logic here
    // For example, "once a week" can be converted to "0 0 * * 0"
    switch (frequency) {
      case 'once a week':
        return '0 0 * * 0';
      case 'twice a month':
        return '0 0 1,15 * *';
      // Add more cases for other frequencies
      default:
        throw new Error(`Unsupported frequency: ${frequency}`);
    }
  }

  async getAllSchedules() {
    return this.scheduleRepository.find();
  }
}