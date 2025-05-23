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
      const newMessage = this.pixMessageRepository.create({
        endToEndId: `E${targetReceiverIspb}<span class="math-inline">\{Date\.now\(\)\}</span>{Math.random().toString(36).substring(2, 10)}`, // Exemplo simples, melhore
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
          ispb: targetReceiverIspb, // ISPB do recebedor (parâmetro)
          agencia: '0002',
          contaTransacional: Math.random().toString().slice(2, 12),
          tipoConta: 'CACC',
        },
        recebedorIspb: targetReceiverIspb, 
        dataHoraPagamento: new Date(),
        status: 'disponivel',
        txId: `TXID${Math.random().toString(36).substring(2, 15)}`,
      });
      messages.push(await this.pixMessageRepository.save(newMessage));
    }
    return messages;
  }
}