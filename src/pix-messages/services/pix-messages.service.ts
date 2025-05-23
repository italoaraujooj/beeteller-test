import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { PixMessage } from '../entities/pix-message.entity';
import { ActiveStreamsService } from '../../active-streams/services/active-streams.service';
import { ActiveStream } from '../../active-streams/entities/active-stream.entity';

export interface StartStreamResult {
  messages: PixMessage[];
  interationId: string;
  pullNextUrl: string;
  statusCode: number;
}

@Injectable()
export class PixMessagesService {
  private readonly logger = new Logger(PixMessagesService.name);

  constructor(
    @InjectRepository(PixMessage)
    private readonly pixMessageRepository: Repository<PixMessage>,
    private readonly activeStreamsService: ActiveStreamsService,
    private readonly dataSource: DataSource, // Para transações
  ) {}

  async startNewPixStream(
    ispb: string,
    acceptHeader?: string,
  ): Promise<StartStreamResult> {
    const activeStream = await this.activeStreamsService.createNewStream(ispb);
    const { interationId } = activeStream;

    const pullNextUrl = `/api/pix/${ispb}/stream/${interationId}`;

    const limit =
      acceptHeader === 'multipart/json' || acceptHeader === 'application/json+M'
        ? 10
        : 1;

    let selectedMessages: PixMessage[] = [];

    await this.dataSource.transaction(async (transactionalEntityManager) => {
      const availableMessages = await transactionalEntityManager.find(
        PixMessage,
        {
          where: {
            recebedorIspb: ispb,
            status: 'disponivel',
          },
          take: limit,
          order: { createdAt: 'ASC' },
        },
      );

      if (availableMessages.length > 0) {
        const messageIdsToLock = availableMessages.map((msg) => msg.id);
        await transactionalEntityManager.update(
          PixMessage,
          { id: In(messageIdsToLock) },
          { status: 'bloqueada', streamId: interationId },
        );
        selectedMessages = availableMessages;
        selectedMessages.forEach((msg) => {
          msg.status = 'bloqueada';
          msg.streamId = interationId;
        });
      }
    });

    if (selectedMessages.length > 0) {
      this.logger.log(
        `Stream ${interationId} started for ISPB ${ispb}, found ${selectedMessages.length} messages.`,
      );
      return {
        messages: selectedMessages,
        interationId,
        pullNextUrl,
        statusCode: 200,
      };
    } else {
      this.logger.log(
        `Stream ${interationId} started for ISPB ${ispb}, no messages found.`,
      );
      return {
        messages: [],
        interationId,
        pullNextUrl,
        statusCode: 204,
      };
    }
  }

  async generateAndSavePixMessages(
    targetReceiverIspb: string,
    count: number,
  ): Promise<PixMessage[]> {
    const messages: PixMessage[] = [];
    for (let i = 0; i < count; i++) {
      const now = new Date();
      const timestamp = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
      const randomPart =
        Math.random().toString(36).substring(2, 12) +
        Math.random().toString(36).substring(2, 12);
      const newEndToEndId = `E${targetReceiverIspb}${timestamp}${i}${randomPart.substring(0, Math.max(0, 22 - i.toString().length))}`;

      const newMessageData: Partial<PixMessage> = {
        endToEndId: newEndToEndId.slice(0, 35),
        valor: parseFloat((Math.random() * 1000).toFixed(2)),
        pagador: {
          nome: 'Pagador Fictício ' + i,
          cpfCnpj: Math.random().toString().slice(2, 13),
          ispb: Math.random().toString().slice(2, 10),
          agencia: '0001',
          contaTransacional: Math.random().toString().slice(2, 10),
          tipoConta: 'CACC',
        },
        recebedor: {
          nome: 'Recebedor Fictício ' + i,
          cpfCnpj: Math.random().toString().slice(2, 13),
          ispb: targetReceiverIspb,
          agencia: '0002',
          contaTransacional: Math.random().toString().slice(2, 12),
          tipoConta: 'CACC',
        },
        recebedorIspb: targetReceiverIspb,
        dataHoraPagamento: now,
        status: 'disponivel',
        txId: `TXID${i}${Math.random().toString(36).substring(2, 15)}`,
      };
      const messageEntity = this.pixMessageRepository.create(newMessageData);
      messages.push(await this.pixMessageRepository.save(messageEntity));
    }
    return messages;
  }
}
