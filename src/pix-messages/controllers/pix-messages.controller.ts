import {
  Controller,
  Get,
  Param,
  Headers,
  Res,
  Logger,
  HttpStatus,
} from '@nestjs/common';
import {
  PixMessagesService,
  StartStreamResult,
} from '../services/pix-messages.service';
import { Response } from 'express';

@Controller('pix') // Rota base /api/pix
export class PixMessagesController {
  private readonly logger = new Logger(PixMessagesController.name);

  constructor(private readonly pixMessagesService: PixMessagesService) {}

  @Get(':ispb/stream/start')
  async startPixStream(
    @Param('ispb') ispb: string,
    @Headers('accept') acceptHeader?: string,
    @Res() response?: Response,
  ): Promise<void> {
    this.logger.log(
      `Request to start stream for ISPB: ${ispb}, Accept: ${acceptHeader}`,
    );

    if (!response) {
      this.logger.error('Response object is undefined in startPixStream');
      return;
    }

    try {
      const result: StartStreamResult =
        await this.pixMessagesService.startNewPixStream(ispb, acceptHeader);

      response.header('Pull-Next', result.pullNextUrl);
      response.status(result.statusCode);

      if (result.statusCode === HttpStatus.OK) {
        response.json(
          acceptHeader === 'multipart/json' ||
            acceptHeader === 'application/json+M'
            ? result.messages
            : result.messages[0],
        );
      } else {
        response.send();
      }
    } catch (error) {
      this.logger.error(
        `Error starting stream for ISPB ${ispb}: ${error.message}`,
        error.stack,
      );
      if (!response.headersSent) {
        response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message:
            'An internal server error occurred while starting the stream.',
        });
      }
    }
  }
}
