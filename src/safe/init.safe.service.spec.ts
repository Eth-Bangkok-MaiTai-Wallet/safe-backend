import { Test, TestingModule } from '@nestjs/testing';
import { InitSafeService } from './init.safe.service';
import { ConfigService } from '@nestjs/config';
import { RpcService } from '../rpc/rpc.service';
import { TransactSafeService } from './transact.safe.service';
import { ConfigSafeService } from './config.safe.service';
import { Erc7579SafeService } from './erc7579.safe.service';

describe('InitSafeService', () => {
  let service: InitSafeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InitSafeService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              switch (key) {
                case 'PIMLICO_API_KEY':
                  return 'test-api-key';
                default:
                  return null;
              }
            }),
          },
        },
        {
          provide: RpcService,
          useValue: {
            createSmartAccountClient: jest.fn(),
            getPublicClient: jest.fn(),
            getPimlicoClient: jest.fn(),
          },
        },
        {
          provide: TransactSafeService,
          useValue: {
            prepareUserOperation: jest.fn(),
          },
        },
        {
          provide: ConfigSafeService,
          useValue: {
            removeSafeOwner: jest.fn(),
          },
        },
        {
          provide: Erc7579SafeService,
          useValue: {
            installOwnableValidatorModule: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<InitSafeService>(InitSafeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
}); 