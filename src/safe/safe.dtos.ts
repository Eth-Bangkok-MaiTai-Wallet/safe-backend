import { IsArray, IsEthereumAddress, IsHexadecimal, IsNumber, IsNumberString, ValidateNested } from "class-validator";
import { Hex } from "viem";
import { Transform, Type } from "class-transformer";
import { IsOptional, IsString } from "class-validator";

class CallDto {
    @IsString()
    type: 'call' = 'call';
  
    @IsString()
    to!: `0x${string}`;
  
    @IsOptional()
    @Transform(({ value }) => (value !== undefined ? BigInt(value) : undefined))
    value?: bigint;
  
    @IsString()
    @IsOptional()
    data?: `0x${string}`;
  }
  
  class ContractCallDto {
    @IsString()
    type: 'contractCall' = 'contractCall';
  
    @IsArray()
    abi!: any[];
  
    @IsString()
    functionName!: string;
  
    @IsArray()
    args!: any[];
  
    @IsString()
    to!: `0x${string}`;
  
    @IsOptional()
    @Transform(({ value }) => (value !== undefined ? BigInt(value) : undefined))
    value?: bigint;
  }
  
export class TransactSafeDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CallDto, {
      discriminator: {
        property: 'type',
        subTypes: [
          { value: CallDto, name: 'call' },
          { value: ContractCallDto, name: 'contractCall' },
        ],
      },
      keepDiscriminatorProperty: true,
    })
    calls!: Array<CallDto | ContractCallDto>;
  }


export class UserOperationCallDto {
    @IsHexadecimal()
    to!: string;
  
    @IsOptional()
    @IsString()
    functionName?: string;
  
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => Object)
    abi?: any[];
  
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => Object)
    args?: any[];
  
    @IsOptional()
    @IsString()
    data?: string;
  }
  
export class UserOperationDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UserOperationCallDto)
    calls!: UserOperationCallDto[];
  
    @IsNumberString()
    nonce!: string;
}

class PublicKeyDto {
  @IsNumber()
  prefix!: number;

  @Transform(({ value }) => BigInt(value))
  @IsNumberString()
  x!: bigint;

  @Transform(({ value }) => BigInt(value))
  @IsNumberString()
  y!: bigint;
}

export class PasskeyDto {
  @IsString()
  name!: string;

  @IsString()
  id!: string;

  @IsString()
  publicKey!: Hex;
}

class MultisigDto {
  @IsArray()
  @IsEthereumAddress({ each: true })
  owners!: string[];

  @IsNumber()
  threshold!: number;
}

export class SafeConfigDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => PasskeyDto)
  passkey?: PasskeyDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MultisigDto)
  multisig?: MultisigDto;

  @IsArray()
  @IsString({ each: true })
  chains!: string[];
}

export class SafeConfigResultDto {
  [chainId: string]: {
    safeAddress: string;
    safeLegacyOwners: string[];
    safeModuleOwners: string[];
    safeModulePasskey?: string | undefined;
  };
}