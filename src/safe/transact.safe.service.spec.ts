import { Test, TestingModule } from '@nestjs/testing';
import { TransactSafeService } from './transact.safe.service';
import { ConfigService } from '@nestjs/config';
import { RpcService } from '../rpc/rpc.service';

describe('TransactSafeService', () => {
  let service: TransactSafeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactSafeService,
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
      ],
    }).compile();

    service = module.get<TransactSafeService>(TransactSafeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
}); 