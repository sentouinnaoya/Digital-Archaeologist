import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import yauzl, { type Entry, type ZipFile } from 'yauzl';
import { languageForPath } from './language-detector';

export interface ExtractedSnapshotFile {
  path: string;
  size: number;
  extension: string | null;
  language: string | null;
}

export interface ZipExtractionResult {
  files: ExtractedSnapshotFile[];
  totalBytes: number;
}

@Injectable()
export class ZipImportService {
  constructor(private readonly configService: ConfigService) {}

  async extract(buffer: Buffer, targetDirectory: string): Promise<ZipExtractionResult> {
    const maxEntries = Number(this.configService.get('MAX_ZIP_ENTRIES') ?? 5000);
    const maxFileBytes =
      Number(this.configService.get('MAX_ZIP_FILE_SIZE_MB') ?? 10) * 1024 * 1024;
    const maxTotalBytes =
      Number(this.configService.get('MAX_ZIP_TOTAL_SIZE_MB') ?? 200) * 1024 * 1024;

    await mkdir(targetDirectory, { recursive: true });

    return new Promise<ZipExtractionResult>((resolvePromise, rejectPromise) => {
      let zipFile: ZipFile | undefined;
      let settled = false;

      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        zipFile?.close();
        if (error instanceof BadRequestException) {
          rejectPromise(error);
          return;
        }
        const message = error instanceof Error ? error.message : 'Invalid ZIP archive';
        const safeMessage = /invalid relative path|absolute path|invalid characters/i.test(
          message,
        )
          ? 'ZIP contains an unsafe path'
          : message;
        rejectPromise(new BadRequestException(safeMessage));
      };

      yauzl.fromBuffer(
        buffer,
        {
          lazyEntries: true,
          decodeStrings: true,
          validateEntrySizes: true,
          strictFileNames: true,
        },
        (error, opened) => {
          if (error || !opened) {
            rejectPromise(
              new BadRequestException(
                error?.message ?? 'Unable to read the ZIP archive',
              ),
            );
            return;
          }

          zipFile = opened;
          const files: ExtractedSnapshotFile[] = [];
          const seen = new Set<string>();
          let entryCount = 0;
          let totalBytes = 0;

          const next = () => {
            if (!settled) opened.readEntry();
          };

          opened.on('entry', (entry: Entry) => {
            try {
              if (settled) return;
              entryCount += 1;
              if (entryCount > maxEntries) {
                throw new BadRequestException(
                  `ZIP archive exceeds the ${maxEntries} entry limit`,
                );
              }
              if (entry.isEncrypted()) {
                throw new BadRequestException('Encrypted ZIP entries are not supported');
              }
              if (isSymlink(entry)) {
                throw new BadRequestException('Symlinks are not permitted in ZIP archives');
              }

              const safePath = assertSafeEntryPath(entry.fileName);
              const fullPath = resolve(targetDirectory, safePath);
              const containment = relative(targetDirectory, fullPath);
              if (
                containment === '' ||
                containment === '..' ||
                containment.startsWith(`..${sep}`) ||
                isAbsolute(containment)
              ) {
                throw new BadRequestException('ZIP entry escapes the extraction directory');
              }

              if (entry.fileName.endsWith('/')) {
                void mkdir(fullPath, { recursive: true }).then(next).catch(fail);
                return;
              }

              if (seen.has(safePath)) {
                throw new BadRequestException(`Duplicate ZIP entry: ${safePath}`);
              }
              seen.add(safePath);

              if (entry.uncompressedSize > maxFileBytes) {
                throw new BadRequestException(
                  `ZIP entry ${safePath} exceeds the ${Math.round(maxFileBytes / 1024 / 1024)} MB file limit`,
                );
              }
              totalBytes += entry.uncompressedSize;
              if (totalBytes > maxTotalBytes) {
                throw new BadRequestException(
                  `ZIP archive exceeds the ${Math.round(maxTotalBytes / 1024 / 1024)} MB uncompressed limit`,
                );
              }

              void mkdir(dirname(fullPath), { recursive: true })
                .then(
                  () =>
                    new Promise<void>((streamResolve, streamReject) => {
                      let written = 0;
                      const limiter = new Transform({
                        transform(chunk: Buffer, _encoding, callback) {
                          written += chunk.length;
                          if (written > maxFileBytes) {
                            callback(
                              new BadRequestException(
                                `ZIP entry ${safePath} exceeds its declared size`,
                              ),
                            );
                            return;
                          }
                          callback(null, chunk);
                        },
                      });

                      opened.openReadStream(entry, (streamError, stream) => {
                        if (streamError || !stream) {
                          streamReject(streamError ?? new Error('Unable to read ZIP entry'));
                          return;
                        }
                        pipeline(stream, limiter, createWriteStream(fullPath))
                          .then(() => streamResolve())
                          .catch(streamReject);
                      });
                    }),
                )
                .then(async () => {
                  const written = (await stat(fullPath)).size;
                  const extension = fileExtension(safePath);
                  files.push({
                    path: safePath,
                    size: written,
                    extension,
                    language: extension ? languageForPath(safePath) : null,
                  });
                  next();
                })
                .catch(fail);
            } catch (validationError) {
              fail(validationError);
            }
          });

          opened.on('end', () => {
            if (settled) return;
            settled = true;
            resolvePromise({ files, totalBytes });
          });

          opened.on('error', (streamError) => fail(streamError));
          next();
        },
      );
    });
  }
}

function isSymlink(entry: Entry): boolean {
  const mode = (entry.externalFileAttributes >>> 16) & 0xffff;
  const reparsePoint = (entry.externalFileAttributes & 0x400) !== 0;
  return (mode & 0o170000) === 0o120000 || reparsePoint;
}

function fileExtension(path: string): string | null {
  const file = path.split('/').pop() ?? '';
  if (!file.includes('.')) return null;
  return file.split('.').pop()?.toLowerCase() ?? null;
}

function assertSafeEntryPath(rawPath: string): string {
  if (
    !rawPath ||
    rawPath.includes('\0') ||
    rawPath.includes('\\') ||
    rawPath.startsWith('/') ||
    rawPath.startsWith('//') ||
    /^[A-Za-z]:/.test(rawPath)
  ) {
    throw new BadRequestException('ZIP contains an unsafe path');
  }

  const segments = rawPath.split('/');
  if (segments.some((segment) => segment === '..')) {
    throw new BadRequestException('ZIP contains a path traversal attempt');
  }

  const safe = segments.filter((segment) => segment !== '' && segment !== '.').join('/');
  if (!safe) throw new BadRequestException('ZIP contains an empty path');
  return safe;
}
