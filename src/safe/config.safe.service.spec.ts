import { Test } from '@nestjs/testing';
import { ConfigSafeService } from './config.safe.service.js';
import { ConfigService } from '@nestjs/config';
import { RpcService } from '../rpc/rpc.service.js';
import { Erc7579SafeService } from './erc7579.safe.service.js';
import { TransactSafeService } from './transact.safe.service.js';
import { describe, it, expect, beforeEach } from 'vitest';
import { config } from 'dotenv';
import { privateKeyToAccount } from 'viem/accounts';
import { Hex, PublicClient } from 'viem';
import { SafeOwnerConfig } from './Typres.js';
import { keccak256 } from 'viem/utils';
import { UserOperationDto } from './safe.dtos.js';
import { encodeValidatorNonce, getOwnableValidatorOwners, getOwnableValidator, getAccount} from '@rhinestone/module-sdk';
import { getAccountNonce } from 'permissionless/actions';
import { entryPoint07Address } from 'viem/account-abstraction';

// Load environment variables
config();

describe('ConfigSafeService Integration Tests', () => {
  let safeConfigService: ConfigSafeService;
  let configService: ConfigService;
  let rpcService: RpcService;
  let erc7579SafeService: Erc7579SafeService;
  let safeTransactionService: TransactSafeService;
  let initializedSmartAccountClient;
  let pk;
  let MODULE_OWNER;
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ConfigSafeService,
        ConfigService,
        RpcService,
        TransactSafeService,
        Erc7579SafeService,

      ],
    }).compile();

    safeConfigService = module.get<ConfigSafeService>(ConfigSafeService);
    configService = module.get<ConfigService>(ConfigService);
    rpcService = module.get<RpcService>(RpcService);
    erc7579SafeService = module.get<Erc7579SafeService>(Erc7579SafeService);
    safeTransactionService = module.get<TransactSafeService>(TransactSafeService);

    MODULE_OWNER = configService.get('PK_ADDRESS')
  });

  describe('initializeSafe', () => {
    it('should initialize a safe with ownable validator module and remove all native owners on Sepolia', async () => {

      const randomInt = Math.floor(Math.random() * (10000 - 100 + 1)) + 100;
      const { smartAccountClient, privateKey } = await rpcService.createSmartAccountClient({chainId: 11155111, privateKey: configService.get('PRIVATE_KEY') as Hex, saltNonce: BigInt(randomInt)});

      const pkAccount = privateKeyToAccount(privateKey);

      console.log('pkAccount', pkAccount.address);

      await erc7579SafeService.installOwnableValidatorModule(smartAccountClient, [MODULE_OWNER], 1);

      const safeOwnersBefore = await safeConfigService.getSafeOwners(11155111, smartAccountClient.account!.address as Hex);
      console.log('Safe owners before:', safeOwnersBefore);

      const zeroBytes32 = "0x0000000000000000000000000000000000000000";

      const safeAddress = smartAccountClient.account!.address;
      const ownerToRemove = pkAccount.address;
      const unspendableAddress = keccak256(zeroBytes32).substring(0, 42);
      const chainId = 11155111; // Sepolia

      console.log('unspendableAddress', unspendableAddress);

      const addOwnerConfig: SafeOwnerConfig = {
        safeAddress,
        ownerAddressToAddOrRemove: unspendableAddress,
        chainId,
        threshold: 1,
        signer: privateKey
      }

      const resultAdd = await safeConfigService.addSafeOwner(addOwnerConfig);

      console.log('resultAdd', resultAdd);

      await new Promise(resolve => setTimeout(resolve, 30000));

      const safeOwnersAfterAdd = await safeConfigService.getSafeOwners(11155111, smartAccountClient.account!.address as Hex);
      console.log('Safe owners after add:', safeOwnersAfterAdd);

      const removeOwnerConfig: SafeOwnerConfig = {
        safeAddress,
        ownerAddressToAddOrRemove: ownerToRemove,
        chainId,
        threshold: 1,
        signer: privateKey
      }

      const resultRemove = await safeConfigService.removeSafeOwner(removeOwnerConfig);

      console.log('Remove owner transaction result:', resultRemove);

      await new Promise(resolve => setTimeout(resolve, 30000));

      const safeOwnersAfter = await safeConfigService.getSafeOwners(11155111, smartAccountClient.account!.address as Hex);

      console.log('Safe owners after remove:', safeOwnersAfter);

      expect(safeOwnersBefore).toContain(pkAccount.address);      
      expect(safeOwnersAfter).not.toContain(ownerToRemove);
      expect(safeOwnersAfter.length).to.equal(1);
      expect(safeOwnersBefore.length).to.equal(1);
      expect(safeOwnersAfter.map(owner => owner.toLowerCase())).toContain(unspendableAddress.toLowerCase());

      initializedSmartAccountClient = smartAccountClient;
      pk = privateKey;

    }, 600000); // Increase timeout for blockchain interaction

    it('should send a transaction using ownable validator module on Sepolia', async () => {

      expect(initializedSmartAccountClient).toBeDefined();
      expect(pk).toBeDefined();

      const publicClient = rpcService.getPublicClient(initializedSmartAccountClient.chain.id);

      const owners = await getOwnableValidatorOwners({
          client: publicClient as PublicClient,
          account: {
            address: initializedSmartAccountClient.account!.address,
            deployedOnChains: [initializedSmartAccountClient.chain.id],
            type: 'safe',
          },
       });

      console.log('owners', owners);
      const pkAccount = privateKeyToAccount(pk);

      expect(owners.length).to.equal(1);
      expect(owners[0].toLowerCase()).to.equal(pkAccount.address.toLowerCase());

      const ownableValidator = getOwnableValidator({
        threshold: 1,
        owners: [owners[0]],
      });

      const account = getAccount({
        address: initializedSmartAccountClient.account!.address,
        type: 'safe',
      })

      const nonce = await getAccountNonce(publicClient, {
        address: initializedSmartAccountClient.account!.address,
        entryPointAddress: entryPoint07Address,
        key: encodeValidatorNonce({ account, validator: ownableValidator }),
      });
  
      const userOp: UserOperationDto = {
        nonce: nonce.toString(),
        calls: [
          {
            to: '0x6D7A849791a8E869892f11E01c2A5f3b25a497B6',
            functionName: 'greet',
            abi: [
              {
                inputs: [],
                name: 'greet', 
                outputs: [],
                stateMutability: 'nonpayable',
                type: 'function',
              },
            ],
            args: [],
          },
        ],
      }

      const {userOperation, userOpHashToSign} = await safeTransactionService.prepareUserOperation(
        userOp, initializedSmartAccountClient
      );

      userOperation.signature = await pkAccount.signMessage({
        message: { raw: userOpHashToSign },
      })
  
      const userOpHash = await initializedSmartAccountClient.sendUserOperation(userOperation)
  
      console.log(`User operation hash: ${userOpHash}`);

      const pimlicoClient = rpcService.getPimlicoClient(initializedSmartAccountClient.chain.id);
   
      const receipt = await pimlicoClient.waitForUserOperationReceipt({
        hash: userOpHash,
      })

      expect(receipt.success).to.be.true;
    }, 600000);

  });
});
