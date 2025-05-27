import { Test, TestingModule } from '@nestjs/testing';
import { PixMessagesService } from './pix-messages.service';
import { ActiveStreamsService } from '../../active-streams/services/active-streams.service';
import { PixMessage } from '../entities/pix-message.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, UpdateResult } from 'typeorm';
import {
  ForbiddenException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ActiveStream } from '../../active-streams/entities/active-stream.entity';
import { v4 as uuidv4 } from 'uuid';

interface MockPixMessageRepository {
  findOne: jest.Mock;
  find: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
  count: jest.Mock;
  update: jest.Mock;
  remove: jest.Mock;
}
const createMockPixMessageRepository = (): MockPixMessageRepository => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  count: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
});

const mockActiveStreamsServiceProvider = {
  provide: ActiveStreamsService,
  useValue: {
    createNewStream: jest.fn(),
    findValidStreamAndTouch: jest.fn(),
    deleteStream: jest.fn(),
  },
};

const mockEntityManager = {
  find: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
};
const mockDataSourceProvider = {
  provide: DataSource,
  useValue: {
    transaction: jest.fn().mockImplementation(async (cb) => {
      return cb(mockEntityManager);
    }),
  },
};

describe('PixMessagesService', () => {
  let service: PixMessagesService;
  let pixMessageRepository: MockPixMessageRepository;
  let activeStreamsServiceMock: typeof mockActiveStreamsServiceProvider.useValue;
  let dataSourceMock: typeof mockDataSourceProvider.useValue;
  let entityManagerMock: typeof mockEntityManager;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PixMessagesService,
        {
          provide: getRepositoryToken(PixMessage),
          useValue: createMockPixMessageRepository(),
        },
        mockActiveStreamsServiceProvider,
        mockDataSourceProvider,
      ],
    }).compile();

    service = module.get<PixMessagesService>(PixMessagesService);
    pixMessageRepository = module.get<MockPixMessageRepository>(
      getRepositoryToken(PixMessage),
    );
    activeStreamsServiceMock =
      module.get<typeof mockActiveStreamsServiceProvider.useValue>(
        ActiveStreamsService,
      );
    dataSourceMock =
      module.get<typeof mockDataSourceProvider.useValue>(DataSource);
    entityManagerMock = mockEntityManager;

    jest.clearAllMocks();
  });

  describe('startNewPixStream', () => {
    const ispb = '12345678';
    const mockActiveStream = {
      interationId: 'test-stream-uuid',
      ispb,
      createdAt: new Date(),
      lastActivityAt: new Date(),
    } as ActiveStream;

    it('should create a stream and return messages if available (initial fetch)', async () => {
      const ispb = '12345678';
      const mockActiveStream = {
        interationId: 'test-stream-uuid',
        ispb,
        createdAt: new Date(),
        lastActivityAt: new Date(),
      } as ActiveStream;

      const mockPixMessages = [
        {
          id: 'msg1',
          endToEndId: 'e2e1',
          status: 'disponivel',
          recebedorIspb: ispb,
          valor: 100.0,
        } as PixMessage,
        {
          id: 'msg2',
          endToEndId: 'e2e2',
          status: 'disponivel',
          recebedorIspb: ispb,
          valor: 200.0,
        } as PixMessage,
      ];
      const expectedLockedMessages = mockPixMessages.map((m) => ({
        ...m,
        status: 'bloqueada',
        streamId: mockActiveStream.interationId,
      }));

      activeStreamsServiceMock.createNewStream.mockResolvedValue(
        mockActiveStream,
      );
      entityManagerMock.find.mockResolvedValue(mockPixMessages);

      entityManagerMock.save.mockImplementation(
        async (EntityClass, dataToSave) => {
          return dataToSave;
        },
      );

      const result = await service.startNewPixStream(ispb, 'multipart/json');

      expect(activeStreamsServiceMock.createNewStream).toHaveBeenCalledWith(
        ispb,
      );
      expect(dataSourceMock.transaction).toHaveBeenCalledTimes(1);
      expect(entityManagerMock.find).toHaveBeenCalledWith(
        PixMessage,
        expect.objectContaining({
          where: { recebedorIspb: ispb, status: 'disponivel' },
          take: 10,
        }),
      );
      expect(entityManagerMock.save).toHaveBeenCalledTimes(
        mockPixMessages.length,
      );
      mockPixMessages.forEach((msgData) => {
        // msgData aqui é o objeto original antes de ser modificado no loop do serviço
        // A asserção aqui deve verificar que o save foi chamado com o objeto *após* as modificações de status e streamId
        expect(entityManagerMock.save).toHaveBeenCalledWith(
          PixMessage,
          expect.objectContaining({
            id: msgData.id, // ou o objeto original 'msg' que foi modificado
            status: 'bloqueada',
            streamId: mockActiveStream.interationId,
          }),
        );
      });

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.interationId).toBe(mockActiveStream.interationId);
      expect(result.pullNextUrl).toBe(
        `/api/pix/${ispb}/stream/${mockActiveStream.interationId}`,
      );
      // Esta asserção deve agora funcionar corretamente:
      expect(result.messages).toEqual(expectedLockedMessages);
    });

    // TODO - FIX
    it('should create a stream and return 204 if no messages are available after polling for 8 seconds', async () => {
      jest.useFakeTimers({ legacyFakeTimers: false });

      const ispb = '12345678';
      const mockActiveStream = {
        interationId: 'test-stream-uuid-timeout',
        ispb,
        createdAt: new Date(),
        lastActivityAt: new Date(),
      } as ActiveStream;

      activeStreamsServiceMock.createNewStream.mockResolvedValue(
        mockActiveStream,
      );
      entityManagerMock.find.mockResolvedValue([]);

      const servicePromise = service.startNewPixStream(
        ispb,
        'application/json',
      );

      jest.runAllTimers();

      const result = await servicePromise;

      expect(activeStreamsServiceMock.createNewStream).toHaveBeenCalledWith(
        ispb,
      );
      expect(dataSourceMock.transaction).toHaveBeenCalled();
      expect(entityManagerMock.find).toHaveBeenCalledWith(
        PixMessage,
        expect.objectContaining({
          where: { recebedorIspb: ispb, status: 'disponivel' },
          take: 1,
        }),
      );
      expect(entityManagerMock.save).not.toHaveBeenCalled();
      expect(result.statusCode).toBe(HttpStatus.NO_CONTENT);
      expect(result.messages).toEqual([]);

      jest.useRealTimers();
    });

    describe('getMessagesForExistingStream', () => {
      const interationId = 'existing-stream-uuid';
      const ispb = '12345678';
      const mockActiveStream = {
        interationId,
        ispb,
        createdAt: new Date(),
        lastActivityAt: new Date(),
      } as ActiveStream;

      it('should return messages if stream is valid and messages are available', async () => {
        const interationId = 'existing-stream-uuid';
        const ispb = '12345678';
        const mockActiveStream = {
          interationId,
          ispb,
          createdAt: new Date(),
          lastActivityAt: new Date(),
        } as ActiveStream;
        const mockPixMessages = [
          {
            id: 'msg3',
            status: 'disponivel',
            recebedorIspb: ispb,
            valor: 300.0,
          } as PixMessage,
        ];
        const expectedLockedMessages = mockPixMessages.map((m) => ({
          ...m,
          status: 'bloqueada',
          streamId: interationId,
        }));

        activeStreamsServiceMock.findValidStreamAndTouch.mockResolvedValue(
          mockActiveStream,
        );
        entityManagerMock.find.mockResolvedValue(mockPixMessages);

        entityManagerMock.save.mockImplementation(
          async (EntityClass, dataToSave) => {
            return dataToSave;
          },
        );

        const result = await service.getMessagesForExistingStream(
          interationId,
          ispb,
          'application/json',
        );

        expect(
          activeStreamsServiceMock.findValidStreamAndTouch,
        ).toHaveBeenCalledWith(interationId, ispb);
        expect(dataSourceMock.transaction).toHaveBeenCalledTimes(1);
        expect(entityManagerMock.find).toHaveBeenCalledWith(
          PixMessage,
          expect.objectContaining({
            where: { recebedorIspb: ispb, status: 'disponivel' },
            take: 1,
          }),
        );
        expect(entityManagerMock.save).toHaveBeenCalledTimes(
          mockPixMessages.length,
        );
        mockPixMessages.forEach((msgData) => {
          expect(entityManagerMock.save).toHaveBeenCalledWith(
            PixMessage,
            expect.objectContaining({
              id: msgData.id,
              status: 'bloqueada',
              streamId: interationId,
            }),
          );
        });

        expect(result.statusCode).toBe(HttpStatus.OK);
        expect(result.messages).toEqual(expectedLockedMessages);
        expect(result.interationId).toBe(interationId);
      });

      // TODO - FIX
      it('should return 204 if stream is valid but no messages are available', async () => {
        activeStreamsServiceMock.findValidStreamAndTouch.mockResolvedValue(
          mockActiveStream,
        );
        entityManagerMock.find.mockResolvedValue([]);

        const result = await service.getMessagesForExistingStream(
          interationId,
          ispb,
          'application/json',
        );

        expect(
          activeStreamsServiceMock.findValidStreamAndTouch,
        ).toHaveBeenCalledWith(interationId, ispb);
        expect(entityManagerMock.find).toHaveBeenCalledTimes(1);
        expect(entityManagerMock.save).not.toHaveBeenCalled();
        expect(result.statusCode).toBe(HttpStatus.NO_CONTENT);
        expect(result.messages).toEqual([]);
      });

      it('should throw NotFoundException if stream is not found', async () => {
        activeStreamsServiceMock.findValidStreamAndTouch.mockRejectedValue(
          new NotFoundException('Stream não encontrado'),
        );

        await expect(
          service.getMessagesForExistingStream(
            interationId,
            ispb,
            'application/json',
          ),
        ).rejects.toThrow(NotFoundException);
      });

      it('should throw ForbiddenException if ISPB does not match stream', async () => {
        activeStreamsServiceMock.findValidStreamAndTouch.mockRejectedValue(
          new ForbiddenException('ISPB não corresponde'),
        );

        await expect(
          service.getMessagesForExistingStream(
            interationId,
            '다른ISPB',
            'application/json',
          ),
        ).rejects.toThrow(ForbiddenException);
      });
    });

    describe('finalizeStream', () => {
      const interationId = 'stream-to-finalize-uuid';
      const ispb = '12345678';

      it('should call activeStreamsService.deleteStream and update message statuses to processed', async () => {
        activeStreamsServiceMock.deleteStream.mockResolvedValue(undefined);
        pixMessageRepository.update.mockResolvedValue({
          affected: 2,
          raw: [],
          generatedMaps: [],
        } as UpdateResult);

        await service.finalizeStream(interationId, ispb);

        expect(activeStreamsServiceMock.deleteStream).toHaveBeenCalledWith(
          interationId,
          ispb,
        );
        expect(pixMessageRepository.update).toHaveBeenCalledWith(
          { streamId: interationId, status: 'bloqueada' },
          { status: 'processada' },
        );
      });

      it('should re-throw NotFoundException if deleteStream throws it', async () => {
        activeStreamsServiceMock.deleteStream.mockRejectedValue(
          new NotFoundException('Stream não encontrado para deletar'),
        );

        await expect(
          service.finalizeStream(interationId, ispb),
        ).rejects.toThrow(NotFoundException);
        expect(pixMessageRepository.update).not.toHaveBeenCalled();
      });

      it('should re-throw ForbiddenException if deleteStream throws it', async () => {
        activeStreamsServiceMock.deleteStream.mockRejectedValue(
          new ForbiddenException('Acesso negado para deletar stream'),
        );

        await expect(
          service.finalizeStream(interationId, ispb),
        ).rejects.toThrow(ForbiddenException);
        expect(pixMessageRepository.update).not.toHaveBeenCalled();
      });
    });

    describe('generateAndSavePixMessages', () => {
      const targetReceiverIspb = '87654321';

      it('should generate and save the specified number of messages', async () => {
        const count = 3;
        pixMessageRepository.create.mockImplementation(
          (partialEntity) => ({ ...partialEntity }) as PixMessage,
        );
        pixMessageRepository.save.mockImplementation(
          async (entity) => ({ ...entity, id: uuidv4() }) as PixMessage,
        );

        const results = await service.generateAndSavePixMessages(
          targetReceiverIspb,
          count,
        );

        expect(pixMessageRepository.create).toHaveBeenCalledTimes(count);
        expect(pixMessageRepository.save).toHaveBeenCalledTimes(count);
        expect(results).toHaveLength(count);
        results.forEach((msg) => {
          expect(msg.recebedorIspb).toBe(targetReceiverIspb);
          expect(msg.status).toBe('disponivel');
          expect(msg.endToEndId).toBeDefined();
          expect(msg.id).toBeDefined();
        });
      });

      it('should return an empty array if count is 0', async () => {
        const results = await service.generateAndSavePixMessages(
          targetReceiverIspb,
          0,
        );
        expect(results).toEqual([]);
        expect(pixMessageRepository.create).not.toHaveBeenCalled();
        expect(pixMessageRepository.save).not.toHaveBeenCalled();
      });

      it('should correctly structure pagador and recebedor objects', async () => {
        pixMessageRepository.create.mockImplementation(
          (partialEntity) => ({ ...partialEntity }) as PixMessage,
        );
        pixMessageRepository.save.mockImplementation(
          async (entity) => ({ ...entity, id: uuidv4() }) as PixMessage,
        );

        const results = await service.generateAndSavePixMessages(
          targetReceiverIspb,
          1,
        );
        expect(results[0].pagador).toBeDefined();
        expect(results[0].pagador.nome).toContain('Pagador Fictício');
        expect(results[0].recebedor).toBeDefined();
        expect(results[0].recebedor.ispb).toBe(targetReceiverIspb);
      });
    });
  });
});
