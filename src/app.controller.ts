import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): Promise<string> {
    return this.appService.getHello();
  }

  @Get('send-user-op')
  sendUserOp(): Promise<string> {
    return this.appService.sendUserOperation();
  }

  @Get('send-user-op2')
  sendUserOp2(): Promise<string> {
    return this.appService.sendUserOperation2();
  }
}
