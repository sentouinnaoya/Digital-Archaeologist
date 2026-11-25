import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { ZipImportService } from '../../src/modules/repositories/zip-import.service';

function config(overrides: Record<string, number> = {}) {
  const defaults: Record<string, number> = {
    MAX_ZIP_ENTRIES: 100,
    MAX_ZIP_FILE_SIZE_MB: 1,
    MAX_ZIP_TOTAL_SIZE_MB: 5,
    ...overrides,
  };
  return { get: (key: string) => defaults[key] } as never;
}

describe('ZipImportService', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'da-zip-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('extracts safe files and records evidence-based metadata', async () => {
    const archive = Buffer.from(
      zipSync({
        'src/index.ts': strToU8('export const value = 1;\n'),
        'README.md': strToU8('# Snapshot\n'),
        'empty/': strToU8(''),
      }),
    );

    const result = await new ZipImportService(config()).extract(
      archive,
      join(root, 'snapshot'),
    );

    expect(result.files.map((file) => file.path).sort()).toEqual([
      'README.md',
      'src/index.ts',
    ]);
    expect(result.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'src/index.ts',
          language: 'TypeScript',
          extension: 'ts',
        }),
      ]),
    );
    expect(
      await readFile(join(root, 'snapshot', 'src', 'index.ts'), 'utf8'),
    ).toBe('export const value = 1;\n');
  });

  it('rejects path traversal entries', async () => {
    const archive = Buffer.from(
      zipSync({ '../outside.txt': strToU8('escaped') }),
    );

    await expect(
      new ZipImportService(config()).extract(archive, join(root, 'snapshot')),
    ).rejects.toThrow('unsafe path');
  });

  it('rejects entries larger than the configured per-file limit', async () => {
    const archive = Buffer.from(
      zipSync({
        'large.txt': strToU8('x'.repeat(2000)),
      }),
    );

    await expect(
      new ZipImportService(config({ MAX_ZIP_FILE_SIZE_MB: 0.001 })).extract(
        archive,
        join(root, 'snapshot'),
      ),
    ).rejects.toThrow('file limit');
  });

  it('rejects archives with too many entries', async () => {
    const entries: Record<string, Uint8Array> = {};
    for (let index = 0; index < 12; index += 1) {
      entries[`file-${index}.txt`] = strToU8('x');
    }
    const archive = Buffer.from(zipSync(entries));

    await expect(
      new ZipImportService(config({ MAX_ZIP_ENTRIES: 5 })).extract(
        archive,
        join(root, 'snapshot'),
      ),
    ).rejects.toThrow('entry limit');
  });
});
