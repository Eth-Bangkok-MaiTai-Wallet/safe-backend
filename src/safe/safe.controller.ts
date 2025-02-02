import { Controller, Post, Body } from '@nestjs/common';
import { InitSafeService } from './init.safe.service.js';
import { ConfigSafeService } from './config.safe.service.js';
import { TransactSafeService } from './transact.safe.service.js';
import { SafeConfigDto, TransactSafeDto } from './safe.dtos.js';
import { Hex } from 'viem';

@Controller('safe')
export class SafeController {
  constructor(
    private readonly initSafeService: InitSafeService,
    private readonly configSafeService: ConfigSafeService,
    private readonly transactSafeService: TransactSafeService,
  ) {}

  @Post('init')
  async initSafe(@Body() data: { ownerAddress: Hex, chainId: number }) {
    return this.initSafeService.initSafeWithOwner(data.ownerAddress, data.chainId);
  }

  @Post('create')
  async configSafe(@Body() config: SafeConfigDto) {
    console.log('configSafe', config);
    return this.configSafeService.configSafe(config);
  }

  @Post('transact')
  async transactSafe(@Body() address: Hex, @Body() chainId: number, @Body() data: TransactSafeDto) {
    return this.transactSafeService.transactSafe(address, chainId, data);
  }
} 