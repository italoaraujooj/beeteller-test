import {
  Controller,
  Get,
  Param,
  Headers,
  Res,
  Logger,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import {
  PixMessagesService,
  StreamProcessingResult,
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
      const result: StreamProcessingResult =
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

  @Get(':ispb/stream/:interationId')
  async getPixStreamMessages(
    @Param('ispb') ispb: string,
    @Param('interationId') interationId: string,
    @Headers('accept') acceptHeader?: string,
    @Res() response?: Response,
  ): Promise<void> {
    this.logger.log(
      `Request to get messages for stream ISPB: ${ispb}, interationId: ${interationId}, Accept: ${acceptHeader}`,
    );

    if (!response) {
      this.logger.error('Response object is undefined in getPixStreamMessages');
      return;
    }

    try {
      const result = await this.pixMessagesService.getMessagesForExistingStream(
        interationId,
        ispb, // Passar o ispb da URL para validação
        acceptHeader,
      );

      response.header('Pull-Next', result.pullNextUrl);
      response.status(result.statusCode);

      if (result.statusCode === HttpStatus.OK && result.messages.length > 0) {
        response.json(
          acceptHeader === 'multipart/json' // Simplifiquei a checagem do multipart
            ? result.messages
            : result.messages[0],
        );
      } else {
        response.send(); // Envia resposta vazia para 204 No Content
      }
    } catch (error) {
      this.logger.error(
        `Error getting messages for stream ${interationId}: ${error.message}`,
        error.stack,
      );
      if (!response.headersSent) {
        if (error instanceof NotFoundException) {
          response
            .status(HttpStatus.NOT_FOUND)
            .json({ message: error.message });
        } else if (error instanceof ForbiddenException) {
          response
            .status(HttpStatus.FORBIDDEN)
            .json({ message: error.message });
        } else {
          response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message:
              'An internal server error occurred while getting messages for the stream.',
          });
        }
      }
    }
  }
}
