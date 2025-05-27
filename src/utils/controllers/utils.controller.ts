import {
  Controller,
  Post,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { PixMessagesService } from '../../pix-messages/services/pix-messages.service';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Utils')
@Controller('util')
export class UtilsController {
  constructor(private readonly pixMessagesService: PixMessagesService) {}

  @Post('msgs/:ispb/:number')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Criar mensagens PIX de teste para um ISPB' }) // Descrição da operação
  @ApiParam({
    name: 'ispb',
    description: 'ISPB do recebedor para as mensagens geradas',
    type: String,
    example: '12345678',
  })
  @ApiParam({
    name: 'number',
    description: 'Quantidade de mensagens a serem criadas (1-1000)',
    type: Number,
    example: 10,
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Mensagens PIX de teste criadas com sucesso.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Parâmetros inválidos (ex: número fora do range).',
  })
  async createTestPixMessages(
    @Param('ispb') ispb: string,
    @Param('number', ParseIntPipe) number: number,
  ) {
    if (number <= 0 || number > 1000) {
      throw new BadRequestException('A quantidade de mensagens deve ser entre 1 e 1000.');
    }
    const messages = await this.pixMessagesService.generateAndSavePixMessages(
      ispb,
      number,
    );
    return {
      message: `${messages.length} mensagens PIX criadas com sucesso para o ISPB ${ispb}.`,
      data: messages,
    };
  }
}
