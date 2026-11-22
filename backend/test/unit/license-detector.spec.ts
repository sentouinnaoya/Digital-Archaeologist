import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectLicense } from '../../src/modules/repositories/license-detector';

describe('detectLicense', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'da-license-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('detects MIT from a LICENSE file', async () => {
    await writeFile(
      join(root, 'LICENSE'),
      'MIT License\n\nPermission is hereby granted, free of charge, to any person obtaining a copy.',
    );

    expect(await detectLicense(root)).toEqual({
      identifier: 'MIT',
      confidence: 'detected',
      path: 'LICENSE',
    });
  });

  it('detects Apache-2.0 from LICENSE.txt', async () => {
    await writeFile(
      join(root, 'LICENSE.txt'),
      'Apache License\nVersion 2.0, January 2004\nhttp://www.apache.org/licenses/',
    );

    expect(await detectLicense(root)).toEqual({
      identifier: 'Apache-2.0',
      confidence: 'detected',
      path: 'LICENSE.txt',
    });
  });

  it('reports unknown when no supported licence file exists', async () => {
    await mkdir(join(root, 'docs'));
    await mkdir(join(root, 'LICENSE'));

    expect(await detectLicense(root)).toEqual({
      identifier: 'No license detected',
      confidence: 'unknown',
      path: null,
    });
  });
});
