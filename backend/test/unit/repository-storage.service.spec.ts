import { BadRequestException } from '@nestjs/common';
import { access, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { RepositoryStorageService } from '../../src/modules/repositories/repository-storage.service';

describe('RepositoryStorageService', () => {
  let root: string;
  let service: RepositoryStorageService;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'da-storage-'));
    service = new RepositoryStorageService({ get: () => root } as never);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('resolves references only inside the configured storage root', () => {
    const reference = service.buildReference('project-1', 'repo-1');
    expect(service.resolveReference(reference)).toBe(resolve(root, 'project-1/repo-1'));
    expect(() => service.resolveReference('../outside')).toThrow(BadRequestException);
    expect(() => service.resolveReference('/etc')).toThrow(BadRequestException);
  });

  it('creates, measures and removes an isolated directory', async () => {
    const reference = service.buildReference('project-1', 'repo-1');
    const target = await service.prepare(reference);
    await mkdir(join(target, 'nested'));
    await writeFile(join(target, 'nested', 'file.txt'), '12345');

    expect(await service.directorySize(reference, 1000)).toBe(5);
    expect(await service.directorySize(reference, 3)).toBeGreaterThan(3);

    await service.remove(reference);
    await expect(access(target)).rejects.toThrow();
  });
});
