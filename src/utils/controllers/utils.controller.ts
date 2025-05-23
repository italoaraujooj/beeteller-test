import {
  Controller,
  Post,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PixMessagesService } from '../../pix-messages/services/pix-messages.service';

@Controller('util')
export class UtilsController {
  constructor(private readonly pixMessagesService: PixMessagesService) {}

  @Post('msgs/:ispb/:number')
  @HttpCode(HttpStatus.CREATED)
  async createTestPixMessages(
    @Param('ispb') ispb: string,
    @Param('number', ParseIntPipe) number: number,
  ) {
    if (number <= 0 || number > 1000) {
      throw new Error('Number of messages must be between 1 and 1000.');
    }
    const messages = await this.pixMessagesService.generateAndSavePixMessages(
      ispb,
      number,
    );
    return {
      message: `${messages.length} PIX messages created successfully for ISPB ${ispb}.`,
      data: messages,
    };
  }
}
