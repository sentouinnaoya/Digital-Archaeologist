import { lstat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { LicenseDetection } from './schemas/repository.schema';

const CANDIDATE_PATHS = [
  'LICENSE',
  'LICENSE.md',
  'LICENSE.txt',
  'LICENCE',
  'LICENCE.md',
  'LICENCE.txt',
  'COPYING',
  'COPYING.md',
  'COPYING.txt',
];

interface Signature {
  identifier: string;
  confidence: LicenseDetection['confidence'];
  pattern: RegExp;
}

const SIGNATURES: Signature[] = [
  {
    identifier: 'Apache-2.0',
    confidence: 'detected',
    pattern: /Apache License\s*Version 2\.0, January 2004/i,
  },
  {
    identifier: 'GPL-3.0',
    confidence: 'detected',
    pattern: /GNU GENERAL PUBLIC LICENSE\s+Version 3/i,
  },
  {
    identifier: 'LGPL',
    confidence: 'detected',
    pattern: /GNU LESSER GENERAL PUBLIC LICENSE/i,
  },
  {
    identifier: 'MPL-2.0',
    confidence: 'detected',
    pattern: /Mozilla Public License Version 2\.0/i,
  },
  {
    identifier: 'BSD-3-Clause',
    confidence: 'detected',
    pattern: /Redistribution and use in source and binary forms[\s\S]{0,3000}?Neither the name of/i,
  },
  {
    identifier: 'BSD-2-Clause',
    confidence: 'likely',
    pattern: /Redistribution and use in source and binary forms[\s\S]{0,3000}?Redistributions in source code must retain/i,
  },
  {
    identifier: 'MIT',
    confidence: 'detected',
    pattern: /Permission is hereby granted, free of charge/i,
  },
];

export const SUPPORTED_LICENSES = SIGNATURES.map((signature) => signature.identifier);

export async function detectLicense(rootDirectory: string): Promise<LicenseDetection> {
  for (const relativePath of CANDIDATE_PATHS) {
    const fullPath = join(rootDirectory, relativePath);
    try {
      const stats = await lstat(fullPath);
      if (!stats.isFile() || stats.size > 1_000_000) continue;
      const contents = await readFile(fullPath, 'utf8');
      const match = SIGNATURES.find((signature) => signature.pattern.test(contents));
      if (match) {
        return {
          identifier: match.identifier,
          confidence: match.confidence,
          path: relativePath,
        };
      }
    } catch {
      // A missing or unreadable candidate file simply means it cannot be used.
    }
  }

  return {
    identifier: 'No license detected',
    confidence: 'unknown',
    path: null,
  };
}
