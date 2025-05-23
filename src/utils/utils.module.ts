import { Module } from '@nestjs/common';
import { UtilsController } from './controllers/utils.controller';
import { PixMessagesModule } from '../pix-messages/pix-messages.module';

@Module({
  imports: [PixMessagesModule],
  controllers: [UtilsController],
})
export class UtilsModule {}