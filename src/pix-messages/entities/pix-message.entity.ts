import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

interface ParticipantInfo {
  nome: string;
  cpfCnpj: string;
  ispb: string;
  agencia: string;
  contaTransacional: string;
  tipoConta: string;
}

@Entity('pix_messages')
export class PixMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, unique: true })
  endToEndId: string;

  @Column('decimal', { precision: 10, scale: 2 })
  valor: number;

  @Column({ type: 'jsonb' })
  pagador: ParticipantInfo;

  @Column({ type: 'jsonb' })
  recebedor: ParticipantInfo;

  @Index()
  @Column({ type: 'varchar', length: 8, name: 'recebedor_ispb' })
  recebedorIspb: string;

  @Column({ type: 'text', nullable: true })
  campoLivre?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  txId?: string;

  @Column('timestamp with time zone')
  dataHoraPagamento: Date;

  @Index()
  @Column({
    type: 'varchar',
    length: 20,
    default: 'disponivel', // 'disponivel', 'bloqueada', 'processada'
  })
  status: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'stream_id' })
  streamId?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
