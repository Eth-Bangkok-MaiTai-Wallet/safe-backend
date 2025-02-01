import { IsArray, IsEthereumAddress, IsHexadecimal, IsNumber, IsNumberString, ValidateNested } from "class-validator";

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


class UserOperationCallDto {
    @IsHexadecimal()
    to!: string;
  
    @IsString()
    functionName!: string;
  
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => Object)
    abi?: any[];
  
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => Object)
    args!: any[];
  }
  
export class UserOperationDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UserOperationCallDto)
    calls!: UserOperationCallDto[];
  
    @IsNumberString()
    nonce!: string;
  }