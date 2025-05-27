import { Test, TestingModule } from '@nestjs/testing';
import { ActiveStreamsService } from './active-streams.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ActiveStream } from '../entities/active-stream.entity';
import { ForbiddenException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';

interface MockActiveStreamRepository {
  findOne: jest.Mock;
  find: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
  count: jest.Mock;
  update: jest.Mock;
  remove: jest.Mock;
}

const createMockActiveStreamRepository = (): MockActiveStreamRepository => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  count: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
});

describe('ActiveStreamsService', () => {
  let service: ActiveStreamsService;
  let activeStreamRepository: MockActiveStreamRepository;

  const mockLogger = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActiveStreamsService,
        {
          provide: getRepositoryToken(ActiveStream),
          useValue: createMockActiveStreamRepository(),
        },
      ],
    })
      .setLogger(mockLogger)
      .compile();

    service = module.get<ActiveStreamsService>(ActiveStreamsService);
    activeStreamRepository = module.get<MockActiveStreamRepository>(
      getRepositoryToken(ActiveStream),
    );
  });

  describe('createNewStream', () => {
    const ispb = '12345678';
    const MAX_CONCURRENT_STREAMS = 6;

    it('should create and save a new active stream if the limit is not reached', async () => {
      const mockStreamData = {
        ispb,
        interationId: 'some-uuid-generated-by-service',
      };
      const createdMockStream = {
        ...mockStreamData,
        createdAt: new Date(),
        lastActivityAt: new Date(),
      } as ActiveStream;

      activeStreamRepository.count.mockResolvedValue(
        MAX_CONCURRENT_STREAMS - 1,
      );
      activeStreamRepository.create.mockImplementation(
        (dto) => ({ ...dto, interationId: 'mock-uuid' }) as ActiveStream,
      );
      activeStreamRepository.save.mockResolvedValue(createdMockStream);

      const result = await service.createNewStream(ispb);

      expect(activeStreamRepository.count).toHaveBeenCalledWith({
        where: { ispb },
      });
      expect(activeStreamRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ ispb }),
      );
      expect(activeStreamRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          ispb: ispb,
          interationId: expect.any(String),
        }),
      );
      expect(result.ispb).toBe(ispb);
      expect(result.interationId).toBeDefined();
    });

    it('should throw HttpException (429) if the concurrent stream limit is reached', async () => {
      activeStreamRepository.count.mockResolvedValue(MAX_CONCURRENT_STREAMS);

      await expect(service.createNewStream(ispb)).rejects.toThrow(
        HttpException,
      );

      try {
        await service.createNewStream(ispb);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      }

      expect(activeStreamRepository.create).not.toHaveBeenCalled();
      expect(activeStreamRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('findValidStreamAndTouch', () => {
    const interationId = 'valid-uuid';
    const ispb = '12345678';
    const mockStream = {
      interationId,
      ispb,
      createdAt: new Date(),
      lastActivityAt: new Date(),
    } as ActiveStream;

    it('should find a stream, update lastActivityAt, and return it if ID and ISPB match', async () => {
      const updatedStream = { ...mockStream, lastActivityAt: new Date() };
      activeStreamRepository.findOne.mockResolvedValue(mockStream);
      activeStreamRepository.save.mockResolvedValue(updatedStream);

      const result = await service.findValidStreamAndTouch(interationId, ispb);

      expect(activeStreamRepository.findOne).toHaveBeenCalledWith({
        where: { interationId },
      });
      expect(activeStreamRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          interationId,
          ispb,
          lastActivityAt: expect.any(Date),
        }),
      );
      expect(result.lastActivityAt.getTime()).toBeGreaterThanOrEqual(
        mockStream.lastActivityAt.getTime(),
      );
      expect(result.ispb).toBe(ispb);
      expect(result.interationId).toBe(interationId);
    });

    it('should throw NotFoundException if the stream is not found', async () => {
      activeStreamRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findValidStreamAndTouch(interationId, ispb),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.findValidStreamAndTouch(interationId, ispb),
      ).rejects.toThrow(
        `Stream com interationId ${interationId} não encontrado.`,
      );
      expect(activeStreamRepository.save).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if the stream is found but ISPB does not match', async () => {
      const differentIspb = '87654321';
      activeStreamRepository.findOne.mockResolvedValue(mockStream);

      await expect(
        service.findValidStreamAndTouch(interationId, differentIspb),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.findValidStreamAndTouch(interationId, differentIspb),
      ).rejects.toThrow(
        `O stream ${interationId} não pertence ao ISPB ${differentIspb}.`,
      );
      expect(activeStreamRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('deleteStream', () => {
    const interationId = 'valid-uuid-to-delete';
    const ispb = '12345678';
    const mockStreamToDelete = {
      interationId,
      ispb,
      createdAt: new Date(),
      lastActivityAt: new Date(),
    } as ActiveStream;

    it('should remove the stream if ID and ISPB match', async () => {
      activeStreamRepository.findOne.mockResolvedValue(mockStreamToDelete);
      activeStreamRepository.remove.mockResolvedValue(mockStreamToDelete);

      await expect(
        service.deleteStream(interationId, ispb),
      ).resolves.toBeUndefined();

      expect(activeStreamRepository.findOne).toHaveBeenCalledWith({
        where: { interationId },
      });
      expect(activeStreamRepository.remove).toHaveBeenCalledWith(
        mockStreamToDelete,
      );
    });

    it('should throw NotFoundException if the stream to delete is not found', async () => {
      activeStreamRepository.findOne.mockResolvedValue(null);

      await expect(service.deleteStream(interationId, ispb)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.deleteStream(interationId, ispb)).rejects.toThrow(
        `Stream com interationId ${interationId} não encontrado.`,
      );
      expect(activeStreamRepository.remove).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if stream to delete is found but ISPB does not match', async () => {
      const differentIspb = '87654321';
      activeStreamRepository.findOne.mockResolvedValue(mockStreamToDelete);

      await expect(
        service.deleteStream(interationId, differentIspb),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.deleteStream(interationId, differentIspb),
      ).rejects.toThrow(
        `O stream ${interationId} não pertence ao ISPB ${differentIspb} fornecido.`, 
      );
      expect(activeStreamRepository.remove).not.toHaveBeenCalled();
    });
  });
});
