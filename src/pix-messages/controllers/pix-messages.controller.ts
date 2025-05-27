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
  Delete,
  HttpCode,
} from '@nestjs/common';
import {
  PixMessagesService,
  StreamProcessingResult,
} from '../services/pix-messages.service';
import { Response } from 'express';
import {
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Pix Streams')
@Controller('pix') // Rota base /api/pix
export class PixMessagesController {
  private readonly logger = new Logger(PixMessagesController.name);

  constructor(private readonly pixMessagesService: PixMessagesService) {}

  @Get(':ispb/stream/start')
  @ApiOperation({
    summary: 'Iniciar um novo stream para coleta de mensagens PIX',
  })
  @ApiParam({
    name: 'ispb',
    description: 'ISPB da instituição para iniciar o stream',
    type: String,
    example: '12345678',
  })
  @ApiHeader({
    name: 'Accept',
    description: 'Tipo de conteúdo aceito (application/json ou multipart/json)',
    required: false,
    enum: ['application/json', 'multipart/json'],
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Mensagens encontradas e stream iniciado. Header Pull-Next presente.' /* Adicione o tipo de resposta aqui */,
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description:
      'Nenhuma mensagem disponível (pode ocorrer após long polling). Header Pull-Next presente.',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Limite de streams ativos para o ISPB atingido.',
  })
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
  @ApiOperation({
    summary: 'Continuar um stream existente para coleta de mensagens PIX',
  })
  @ApiParam({
    name: 'ispb',
    description: 'ISPB da instituição do stream',
    type: String,
    example: '12345678',
  })
  @ApiParam({
    name: 'interationId',
    description: 'ID da interação do stream a ser continuado',
    type: String,
    example: 'f837491d-d56a-423c-8118-48322a305e5a',
  })
  @ApiHeader({
    name: 'Accept',
    description:
      'Tipo de conteúdo aceito (application/json para uma mensagem, multipart/json para múltiplas)',
    required: false,
    enum: ['application/json', 'multipart/json'],
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Novas mensagens encontradas para o stream. Header Pull-Next presente. Retorna PixMessage ou PixMessage[].',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description:
      'Nenhuma nova mensagem disponível para o stream (pode ocorrer após long polling). Header Pull-Next presente.',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Stream não encontrado ou ISPB não corresponde ao stream.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Acesso ao stream não permitido para o ISPB fornecido.',
  })
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
        ispb,
        acceptHeader,
      );

      response.header('Pull-Next', result.pullNextUrl);
      response.status(result.statusCode);

      if (result.statusCode === HttpStatus.OK && result.messages.length > 0) {
        response.json(
          acceptHeader === 'multipart/json'
            ? result.messages
            : result.messages[0],
        );
      } else {
        response.send();
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

  @Delete(':ispb/stream/:interationId')
  @HttpCode(HttpStatus.OK) // O padrão para DELETE sem corpo é 204, mas o desafio pede 200 com {}
  @ApiOperation({ summary: 'Finalizar um stream de coleta de mensagens PIX' })
  @ApiParam({
    name: 'ispb',
    description: 'ISPB da instituição do stream',
    type: String,
    example: '12345678',
  })
  @ApiParam({
    name: 'interationId',
    description: 'ID da interação do stream a ser finalizado',
    type: String,
    example: 'f837491d-d56a-423c-8118-48322a305e5a',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Stream finalizado com sucesso. Retorna um objeto vazio.',
    content: { 'application/json': { schema: { type: 'object' } } },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Stream não encontrado ou ISPB não corresponde ao stream.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description:
      'Acesso para deletar o stream não permitido para o ISPB fornecido.',
  })
  async finalizePixStream(
    @Param('ispb') ispb: string,
    @Param('interationId') interationId: string,
    @Res() response?: Response,
  ): Promise<void> {
    this.logger.log(
      `Request to finalize stream for ISPB: ${ispb}, interationId: ${interationId}`,
    );

    if (!response) {
      this.logger.error('Response object is undefined in finalizePixStream');
      return;
    }

    try {
      await this.pixMessagesService.finalizeStream(interationId, ispb);
      response.json({});
    } catch (error) {
      this.logger.error(
        `Error finalizing stream ${interationId}: ${error.message}`,
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
              'An internal server error occurred while finalizing the stream.',
          });
        }
      }
    }
  }
}
