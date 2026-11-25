import { ConflictException } from '@nestjs/common';
import { Types } from 'mongoose';
import { RepositoriesService } from '../../src/modules/repositories/repositories.service';

describe('RepositoriesService', () => {
  it('refuses to start a re-analysis while another job is active', async () => {
    const ownerId = new Types.ObjectId();
    const repositoryId = new Types.ObjectId();
    const repositoriesRepository = {
      findByIdAndOwner: jest.fn().mockResolvedValue({
        _id: repositoryId,
        projectId: new Types.ObjectId(),
        ownerId,
        status: 'ready',
        repositoryUrl: 'https://github.com/example/repository.git',
        localStorageReference: 'project/repository',
      }),
      findLatestJob: jest.fn().mockResolvedValue({ status: 'running' }),
      createJob: jest.fn(),
    };
    const service = new RepositoriesService(
      repositoriesRepository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.reanalyze(ownerId.toString(), repositoryId.toString()),
    ).rejects.toThrow(ConflictException);
    expect(repositoriesRepository.createJob).not.toHaveBeenCalled();
  });
});
