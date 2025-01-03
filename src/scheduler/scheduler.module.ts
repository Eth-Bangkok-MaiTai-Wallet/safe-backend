// scheduling.model.ts
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Schedule {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column()
  frequency!: string;

  @Column()
  interval!: number;

  @Column()
  nextExecution!: Date;

  @Column()
  lastExecution!: Date;
}