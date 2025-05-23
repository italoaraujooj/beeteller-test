import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PixMessage } from '../entities/pix-message.entity';

@Injectable()
export class PixMessagesService {
  constructor(
    @InjectRepository(PixMessage)
    private readonly pixMessageRepository: Repository<PixMessage>,
  ) {}

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

      const newMessage = this.pixMessageRepository.create({
        endToEndId: newEndToEndId.slice(0, 35),
        valor: parseFloat((Math.random() * 1000).toFixed(2)),
        pagador: {
          nome: 'Pagador Fictício ' + i,
          cpfCnpj: Math.random().toString().slice(2, 13),
          ispb: Math.random().toString().slice(2, 10), // ISPB do pagador
          agencia: '0001',
          contaTransacional: Math.random().toString().slice(2, 10),
          tipoConta: 'CACC',
        },
        recebedor: {
          nome: 'Recebedor Fictício ' + i,
          cpfCnpj: Math.random().toString().slice(2, 13),
          ispb: targetReceiverIspb, // ISPB do recebedor
          agencia: '0002',
          contaTransacional: Math.random().toString().slice(2, 12),
          tipoConta: 'CACC',
        },
        recebedorIspb: targetReceiverIspb,
        dataHoraPagamento: now,
        status: 'disponivel',
        txId: `TXID${i}${Math.random().toString(36).substring(2, 15)}`,
      });
      messages.push(await this.pixMessageRepository.save(newMessage));
    }
    return messages;
  }
}
