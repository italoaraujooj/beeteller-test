import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('active_streams')
export class ActiveStream {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  interationId: string;

  @Index()
  @Column({ type: 'varchar', length: 8 })
  ispb: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'last_activity_at' })
  lastActivityAt: Date;
}
