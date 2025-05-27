import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ParticipantInfoDto } from '../dto/participant-info.dto';

@Entity('pix_messages')
export class PixMessage {
  @ApiProperty({
    description: 'ID único da mensagem Pix no sistema (UUID).',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    type: String,
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    description:
      'Identificador End-to-End único da transação Pix (gerado pelo PSP do pagador).',
    example: 'E12345678202405271200ABC123XYZ',
    type: String,
    maxLength: 255,
    uniqueItems: true,
  })
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, unique: true })
  endToEndId: string;

  @ApiProperty({
    description:
      'Valor da transação Pix. Retornado como string para garantir precisão.',
    example: '123.45',
    type: String,
  })
  @Column('decimal', { precision: 10, scale: 2 })
  valor: number;

  @ApiProperty({
    description: 'Informações do pagador.',
    type: () => ParticipantInfoDto,
  })
  @Column({ type: 'jsonb' })
  pagador: ParticipantInfoDto;

  @ApiProperty({
    description: 'Informações do recebedor.',
    type: () => ParticipantInfoDto,
  })
  @Column({ type: 'jsonb' })
  recebedor: ParticipantInfoDto; 

  @ApiProperty({
    description:
      'ISPB denormalizado do recebedor, para otimização de consultas.',
    example: '87654321',
    type: String,
    maxLength: 8,
  })
  @Index()
  @Column({ type: 'varchar', length: 8, name: 'recebedor_ispb' })
  recebedorIspb: string;

  @ApiPropertyOptional({
    description:
      'Campo livre para informações adicionais sobre a transação PIX (opcional).',
    example: 'Pagamento referente à nota fiscal XYZ.',
    type: String,
  })
  @Column({ type: 'text', nullable: true })
  campoLivre?: string;

  @ApiPropertyOptional({
    description:
      'ID da transação definido pelo usuário recebedor (txid do QR Code dinâmico ou estático).',
    example: 'txidGeradoPeloRecebedor123',
    type: String,
    maxLength: 255,
  })
  @Column({ type: 'varchar', length: 255, nullable: true })
  txId?: string;

  @ApiProperty({
    description: 'Data e hora do pagamento da transação Pix.',
    example: '2024-05-27T12:00:00.000Z',
    type: Date,
  })
  @Column('timestamp with time zone')
  dataHoraPagamento: Date;

  @ApiProperty({
    description: 'Status atual da mensagem Pix no sistema de coleta.',
    example: 'disponivel',
    enum: ['disponivel', 'bloqueada', 'processada'],
    default: 'disponivel',
    type: String,
  })
  @Index()
  @Column({
    type: 'varchar',
    length: 20,
    default: 'disponivel',
  })
  status: string;

  @ApiPropertyOptional({
    description:
      'ID do stream que está atualmente processando ou processou esta mensagem (opcional).',
    example: 'b4c3d2a1-f6e5-0987-4321-abcdef123456',
    type: String,
  })
  @Column({ type: 'varchar', length: 255, nullable: true, name: 'stream_id' })
  streamId?: string;

  @ApiProperty({
    description: 'Data e hora de criação do registro no sistema.',
    readOnly: true,
    type: Date,
  })
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty({
    description: 'Data e hora da última atualização do registro no sistema.',
    readOnly: true,
    type: Date,
  })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
