import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActiveStream } from './entities/active-stream.entity';
import { ActiveStreamsService } from './services/active-streams.service';

@Module({
  imports: [TypeOrmModule.forFeature([ActiveStream])],
  providers: [ActiveStreamsService],
  exports: [ActiveStreamsService],
})
export class ActiveStreamsModule {}
