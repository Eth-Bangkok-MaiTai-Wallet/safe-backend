import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class DCASchedule {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  accountAddress!: string;

  @Column()
  tokenIn!: string;

  @Column()
  tokenOut!: string;

  @Column('decimal')
  amountIn!: string;

  @Column()
  frequency!: number; // in seconds

  @Column({ type: 'timestamp' })
  nextExecutionTime!: Date;

  @Column({ default: true })
  active!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ nullable: true })
  lastExecutionTime?: Date;

  @Column({ default: 0 })
  executionCount!: number;
}