import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActiveStream } from './entities/active-stream.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ActiveStream])], // Registra a entidade ActiveStream
})
export class ActiveStreamsModule {}
