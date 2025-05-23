import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PixMessage } from './entities/pix-message.entity';
import { PixMessagesService } from './services/pix-messages.service';
import { PixMessagesController } from './controllers/pix-messages.controller';
import { ActiveStreamsModule } from '../active-streams/active-streams.module'; 

@Module({
  imports: [
    TypeOrmModule.forFeature([PixMessage]), 
    ActiveStreamsModule,
  ],
  controllers: [PixMessagesController],
  providers: [PixMessagesService],
  exports: [PixMessagesService],
})
export class PixMessagesModule {}