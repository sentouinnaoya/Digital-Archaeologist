import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lstat, mkdir, readdir, rm } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

@Injectable()
export class RepositoryStorageService {
  constructor(private readonly configService: ConfigService) {}

  getRoot(): string {
    const configured = String(this.configService.get('STORAGE_ROOT') ?? './storage');
    return resolve(process.cwd(), configured);
  }

  buildReference(projectId: string, repositoryId: string): string {
    return `${projectId}/${repositoryId}`;
  }

  resolveReference(reference: string): string {
    const root = this.getRoot();
    const target = resolve(root, reference);
    const relativePath = relative(root, target);
    if (
      relativePath === '' ||
      relativePath === '..' ||
      relativePath.startsWith(`..${sep}`) ||
      isAbsolute(relativePath)
    ) {
      throw new BadRequestException('Invalid repository storage reference');
    }
    return target;
  }

  async prepare(reference: string): Promise<string> {
    const target = this.resolveReference(reference);
    await mkdir(target, { recursive: true });
    return target;
  }

  async remove(reference: string): Promise<void> {
    await rm(this.resolveReference(reference), { recursive: true, force: true });
  }

  async directorySize(reference: string, stopAboveBytes: number): Promise<number> {
    const target = this.resolveReference(reference);

    const walk = async (directory: string): Promise<number> => {
      let total = 0;
      const entries = await readdir(directory, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = resolve(directory, entry.name);
        if (entry.isSymbolicLink()) continue;
        const stats = await lstat(fullPath);
        if (stats.isDirectory()) {
          total += await walk(fullPath);
        } else if (stats.isFile()) {
          total += stats.size;
        }
        if (total > stopAboveBytes) return total;
      }
      return total;
    };

    return walk(target);
  }
}
