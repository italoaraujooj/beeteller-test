import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PixMessage } from './entities/pix-message.entity';
import { PixMessagesService } from './services/pix-messages.service';

@Module({
  imports: [TypeOrmModule.forFeature([PixMessage])],
  providers: [PixMessagesService], // Registra a entidade PixMessage neste módulo
  // controllers: [PixMessagesController], // Adicionará depois
  exports: [PixMessagesService]
})
export class PixMessagesModule {}