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
    const activeStream = await this.activeStreamsService.createNewStream(ispb);
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
  // OBS.: Modificado para incluir o Long Polling
  private async fetchAndLockMessagesForStream(
    streamIspb: string,
    streamInterationId: string,
    acceptHeader?: string,
  ): Promise<StreamProcessingResult> {
    const pullNextUrl = `/api/pix/${streamIspb}/stream/${streamInterationId}`;
    const limit = acceptHeader === 'multipart/json' ? 10 : 1;
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
        const lockedMessages: PixMessage[] = [];
        for (const msg of availableMessages) {
          msg.status = 'bloqueada';
          msg.streamId = streamInterationId;
          const savedMsg = await transactionalEntityManager.save(
            PixMessage,
            msg,
          );
          lockedMessages.push(savedMsg);
        }
        selectedMessages = lockedMessages;
      }
    });

    // --- Lógica de Long Polling (se nenhuma mensagem foi encontrada inicialmente) ---
    if (selectedMessages.length === 0) {
      this.logger.log(
        `Nenhuma mensagem para stream ${streamInterationId} inicialmente. Iniciando long poll (max 8s)...`,
      );
      const pollingEndTime = Date.now() + 8000;
      const pollingInterval = 500;

      while (Date.now() < pollingEndTime) {
        await new Promise((resolve) => setTimeout(resolve, pollingInterval));

        await this.dataSource.transaction(
          async (transactionalEntityManager) => {
            const availableMessagesDuringPoll =
              await transactionalEntityManager.find(PixMessage, {
                where: {
                  recebedorIspb: streamIspb,
                  status: 'disponivel',
                },
                take: limit,
                order: { createdAt: 'ASC' },
              });

            if (availableMessagesDuringPoll.length > 0) {
              const lockedMessagesInPoll: PixMessage[] = [];
              for (const msg of availableMessagesDuringPoll) {
                msg.status = 'bloqueada';
                msg.streamId = streamInterationId;
                const savedMsg = await transactionalEntityManager.save(
                  PixMessage,
                  msg,
                );
                lockedMessagesInPoll.push(savedMsg);
              }
              selectedMessages = lockedMessagesInPoll;
            }
          },
        );

        if (selectedMessages.length > 0) {
          this.logger.log(
            `Encontrada(s) ${selectedMessages.length} mensagem(ns) para stream ${streamInterationId} durante long poll.`,
          );
          break;
        }
      }

      if (selectedMessages.length === 0) {
        this.logger.log(
          `Long poll para stream ${streamInterationId} expirou. Nenhuma mensagem encontrada.`,
        );
      }
    }

    if (selectedMessages.length > 0) {
      this.logger.log(
        `Stream ${streamInterationId} (ISPB ${streamIspb}), retornando ${selectedMessages.length} mensagens bloqueadas.`,
      );
      return {
        messages: selectedMessages,
        interationId: streamInterationId,
        pullNextUrl,
        statusCode: 200,
      };
    } else {
      this.logger.log(
        `Stream ${streamInterationId} (ISPB ${streamIspb}), nenhuma mensagem disponível após polling. Retornando 204.`,
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
  ): Promise<any[]> {
    const messages: PixMessage[] = [];
    for (let i = 0; i < count; i++) {
      const now = new Date();
      const timestamp = `${now.getFullYear()}${(now.getMonth() + 1)
        .toString()
        .padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}${now
        .getHours()
        .toString()
        .padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now
        .getSeconds()
        .toString()
        .padStart(2, '0')}`;
      const randomPart = (
        Math.random().toString(36).substring(2, 12) +
        Math.random().toString(36).substring(2, 12)
      ).padEnd(22, '0');

      const uniqueSuffix = `${i}${randomPart}`;
      const availableLengthForSuffix =
        35 - 1 - targetReceiverIspb.length - timestamp.length;
      const actualSuffix = uniqueSuffix.substring(
        0,
        Math.max(0, availableLengthForSuffix),
      );
      const newEndToEndId = `E${targetReceiverIspb}${timestamp}${actualSuffix}`;

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
        } as any,
        recebedor: {
          nome: 'Recebedor Fictício ' + i,
          cpfCnpj: Math.random().toString().slice(2, 13),
          ispb: targetReceiverIspb,
          agencia: '0002',
          contaTransacional: Math.random().toString().slice(2, 12),
          tipoConta: 'CACC',
        } as any,
        recebedorIspb: targetReceiverIspb,
        dataHoraPagamento: now,
        status: 'disponivel',
        txId: `TXID${i}${Math.random().toString(36).substring(2, 15)}`,
      };
      const messageEntity = this.pixMessageRepository.create(newMessageData);
      messages.push(await this.pixMessageRepository.save(messageEntity));
    }
    return messages.map((msg) => ({
      ...msg,
      valor: msg.valor.toFixed(2),
    }));
  }

  async finalizeStream(
    interationId: string,
    ispbFromPath: string,
  ): Promise<void> {
    await this.activeStreamsService.deleteStream(interationId, ispbFromPath);
    const updateResult = await this.pixMessageRepository.update(
      { streamId: interationId, status: 'bloqueada' }, // Condição para encontrar as mensagens do stream
      { status: 'processada' }, // Novo status
    );

    this.logger.log(
      `Stream ${interationId} for ISPB ${ispbFromPath} finalized. ${updateResult.affected || 0} PIX messages marked as processed.`,
    );
  }
}
