import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Task } from './task.entity';

@Entity('task_criteria')
export class TaskCriterion {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) taskId!: string;
  @ManyToOne(() => Task, (task) => task.criteria, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId' })
  task!: Task;
  @Column({ type: 'text' }) text!: string;
  @Column({ type: 'smallint' }) position!: number;
  @Column({ type: 'boolean', default: false }) passed!: boolean;
  @Column({ type: 'boolean', nullable: true }) firstReviewPassed!: boolean | null;
}
