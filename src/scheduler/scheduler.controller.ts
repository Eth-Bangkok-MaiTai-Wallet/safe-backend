// scheduling.controller.ts
import { Controller, Post, Body, Put, Param, Delete, Get } from '@nestjs/common';
import { SchedulingService } from './scheduler.service.js';
import { Schedule } from './scheduler.module.js';

@Controller('scheduling')
export class SchedulingController {
  constructor(private readonly schedulingService: SchedulingService) {}

  @Post()
  async createSchedule(@Body() schedule: Schedule) {
    return this.schedulingService.createSchedule(schedule);
  }

  @Put(':id')
  async updateSchedule(@Param('id') id: number, @Body() schedule: Schedule) {
    return this.schedulingService.updateSchedule(id, schedule);
  }

  @Delete(':id')
  async deleteSchedule(@Param('id') id: number) {
    return this.schedulingService.deleteSchedule(id);
  }

  @Get()
  async getSchedules() {
    return this.schedulingService.getAllSchedules();
  }
  
}