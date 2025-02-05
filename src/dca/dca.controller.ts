import { Controller, Post, Body, Get, Param, Delete, Put } from '@nestjs/common';
import { DCAService } from './dca.service.js';
import { CreateDCAScheduleDto, UpdateDCAScheduleDto } from './dca.dto.js';

@Controller('dca')
export class DCAController {
  constructor(private readonly dcaService: DCAService) {}

  @Post()
  async createSchedule(@Body() createDto: CreateDCAScheduleDto) {
    return this.dcaService.createSchedule(createDto);
  }

  @Get()
  async getSchedules() {
    return this.dcaService.getAllSchedules();
  }

  @Get(':id')
  async getSchedule(@Param('id') id: number) {
    return this.dcaService.getSchedule(id);
  }

  @Put(':id')
  async updateSchedule(
    @Param('id') id: number,
    @Body() updateDto: UpdateDCAScheduleDto,
  ) {
    return this.dcaService.updateSchedule(id, updateDto);
  }

  @Delete(':id')
  async deleteSchedule(@Param('id') id: number) {
    return this.dcaService.deleteSchedule(id);
  }
}