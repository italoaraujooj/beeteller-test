import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ActiveStream } from '../entities/active-stream.entity';

@Injectable()
export class ActiveStreamsService {
  constructor(
    @InjectRepository(ActiveStream)
    private readonly activeStreamRepository: Repository<ActiveStream>,
  ) {}

  async createNewStream(ispb: string): Promise<ActiveStream> {
    const interationId = uuidv4();
    const newStream = this.activeStreamRepository.create({
      interationId,
      ispb,
    });
    return this.activeStreamRepository.save(newStream);
  }
}
