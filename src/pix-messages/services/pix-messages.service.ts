import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { PixMessage } from '../entities/pix-message.entity';
import { ActiveStreamsService } from '../../active-streams/services/active-streams.service';

export interface StreamProcessingResult {
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
  ): Promise<StreamProcessingResult> {
    // Interface renomeada
    // 1. Cria um novo stream e obtém o interationId
    const activeStream = await this.activeStreamsService.createNewStream(ispb);

    // 2. Chama o método auxiliar para buscar e bloquear mensagens
    this.logger.log(
      `Novo stream iniciado: ${activeStream.interationId} para ISPB ${ispb}`,
    );
    return this.fetchAndLockMessagesForStream(
      activeStream.ispb,
      activeStream.interationId,
      acceptHeader,
    );
  }

  async getMessagesForExistingStream(
    currentInterationId: string,
    ispbFromPath: string, // ISPB da URL para validação
    acceptHeader?: string,
  ): Promise<StreamProcessingResult> {
    const activeStream =
      await this.activeStreamsService.findValidStreamAndTouch(
        currentInterationId,
        ispbFromPath,
      );

    this.logger.log(
      `Continuando stream: ${currentInterationId} para ISPB ${activeStream.ispb}`,
    );
    return this.fetchAndLockMessagesForStream(
      activeStream.ispb,
      currentInterationId,
      acceptHeader,
    );
  }

  /**
   * Método auxiliar privado para buscar mensagens disponíveis, bloqueá-las
   * e preparar o resultado do processamento do stream.
   */
  private async fetchAndLockMessagesForStream(
    streamIspb: string, 
    streamInterationId: string, 
    acceptHeader?: string,
  ): Promise<StreamProcessingResult> {
    const pullNextUrl = `/api/pix/${streamIspb}/stream/${streamInterationId}`;
    const limit =
      acceptHeader === 'multipart/json'
        ? 10
        : 1;

    let selectedMessages: PixMessage[] = [];

    await this.dataSource.transaction(async (transactionalEntityManager) => {
      const availableMessages = await transactionalEntityManager.find(
        PixMessage,
        {
          where: {
            recebedorIspb: streamIspb, 
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
          { status: 'bloqueada', streamId: streamInterationId },
        );

        selectedMessages = availableMessages.map((msg) => ({
          ...msg, 
          status: 'bloqueada',
          streamId: streamInterationId,
        }));
      }
    });

    if (selectedMessages.length > 0) {
      this.logger.log(
        `Stream ${streamInterationId} (ISPB ${streamIspb}), encontrou e bloqueou ${selectedMessages.length} mensagens.`,
      );
      return {
        messages: selectedMessages,
        interationId: streamInterationId,
        pullNextUrl,
        statusCode: 200,
      };
    } else {
      this.logger.log(
        `Stream ${streamInterationId} (ISPB ${streamIspb}), nenhuma nova mensagem encontrada.`,
      );
      return {
        messages: [],
        interationId: streamInterationId,
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
