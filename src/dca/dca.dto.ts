export class CreateDCAScheduleDto {
    accountAddress!: string;
    tokenIn!: string;
    tokenOut!: string;
    amountIn!: string;
    frequency!: number;
}
  
export class UpdateDCAScheduleDto {
    active?: boolean;
    frequency?: number;
    amountIn?: string;
}