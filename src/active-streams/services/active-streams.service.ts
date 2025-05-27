import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ActiveStream } from '../entities/active-stream.entity';

@Injectable()
export class ActiveStreamsService {
  private readonly logger = new Logger(ActiveStreamsService.name);

  constructor(
    @InjectRepository(ActiveStream)
    private readonly activeStreamRepository: Repository<ActiveStream>,
  ) {}

  async createNewStream(ispb: string): Promise<ActiveStream> {
    const activeCount = await this.activeStreamRepository.count({
      where: { ispb },
    });

    const MAX_CONCURRENT_STREAMS = 6;
    if (activeCount >= MAX_CONCURRENT_STREAMS) {
      this.logger.warn(
        `Tentativa de criar novo stream para ISPB ${ispb} falhou: limite de ${MAX_CONCURRENT_STREAMS} streams ativos atingido. Atuais: ${activeCount}.`,
      );
      throw new HttpException(
        `Limite máximo de ${MAX_CONCURRENT_STREAMS} streams ativos para o ISPB ${ispb} foi atingido.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const interationId = uuidv4();
    const newStream = this.activeStreamRepository.create({
      interationId,
      ispb,
    });
    this.logger.log(
      `Criando novo stream ${interationId} para ISPB ${ispb}. Contagem atual antes deste: ${activeCount}`,
    );
    return this.activeStreamRepository.save(newStream);
  }

  async findValidStreamAndTouch(
    interationId: string,
    expectedIspbFromPath: string,
  ): Promise<ActiveStream> {
    const stream = await this.activeStreamRepository.findOne({
      where: { interationId },
    });

    if (!stream) {
      this.logger.warn(
        `Stream com interationId ${interationId} não encontrado.`,
      );
      throw new NotFoundException(
        `Stream com interationId ${interationId} não encontrado.`,
      );
    }

    if (stream.ispb !== expectedIspbFromPath) {
      this.logger.warn(
        `ISPB da URL (${expectedIspbFromPath}) não corresponde ao ISPB do stream ${interationId} (${stream.ispb}).`,
      );
      throw new ForbiddenException(
        `O stream ${interationId} não pertence ao ISPB ${expectedIspbFromPath}.`,
      );
    }

    stream.lastActivityAt = new Date();
    this.logger.log(`Atualizando lastActivityAt para o stream ${interationId}`);
    return this.activeStreamRepository.save(stream);
  }

  async deleteStream(
    interationId: string,
    expectedIspbFromPath: string,
  ): Promise<void> {
    const stream = await this.activeStreamRepository.findOne({
      where: { interationId },
    });

    if (!stream) {
      this.logger.warn(
        `Tentativa de deletar stream inexistente: ${interationId}.`,
      );
      throw new NotFoundException(
        `Stream com interationId ${interationId} não encontrado.`,
      );
    }

    if (stream.ispb !== expectedIspbFromPath) {
      this.logger.warn(
        `ISPB da URL (${expectedIspbFromPath}) não corresponde ao ISPB do stream ${interationId} (${stream.ispb}) na tentativa de deleção.`,
      );
      throw new ForbiddenException(
        `O stream ${interationId} não pertence ao ISPB ${expectedIspbFromPath} fornecido.`,
      );
    }

    this.logger.log(
      `Deletando stream ${interationId} para ISPB ${stream.ispb}`,
    );
    await this.activeStreamRepository.remove(stream);
  }
}
