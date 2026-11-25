import {
  buildArchitectureSnapshot,
  compareArchitectureSnapshots,
  type ArchitectureInput,
} from '../../src/modules/architecture-analysis/architecture.builder';
import type { GraphSourceFile } from '../../src/modules/dependency-analysis/dependency-graph.builder';

function file(
  path: string,
  options: Partial<GraphSourceFile> = {},
): GraphSourceFile {
  return {
    path,
    language: 'TypeScript',
    parser: 'tree-sitter-typescript',
    status: 'parsed',
    imports: [],
    modules: [],
    symbols: [],
    truncated: false,
    ...options,
  };
}

function input(files: GraphSourceFile[], commitHash = 'aaa111'): ArchitectureInput {
  return {
    repositoryId: '507f1f77bcf86cd799439011',
    projectId: '507f191e810c19729de860ea',
    commitHash,
    analyzerVersion: '0.1.0',
    sourceType: 'git_url',
    files,
    fileLimitApplied: false,
  };
}

describe('buildArchitectureSnapshot', () => {
  it('derives modules and claims from observed paths, imports and symbols', () => {
    const snapshot = buildArchitectureSnapshot(
      input([
        file('src/main.ts', {
          imports: [
            { source: 'express', kind: 'static', names: [], line: 1 },
            { source: './core/user-service', kind: 'static', names: [], line: 2 },
          ],
        }),
        file('src/core/user-service.ts', {
          imports: [{ source: './../api/handler', kind: 'static', names: [], line: 3 }],
          symbols: [
            { name: 'UserService', kind: 'class_declaration', startLine: 5, endLine: 8 },
          ],
        }),
        file('src/api/handler.ts', {
          imports: [{ source: 'axios', kind: 'static', names: [], line: 1 }],
        }),
        file('src/admin/server.ts'),
        file('Dockerfile', {
          language: null,
          parser: 'unsupported',
          status: 'unsupported',
        }),
      ]),
    );

    expect(snapshot.modules.map((module) => module.id)).toEqual(
      expect.arrayContaining([
        'module:src',
        'module:src/core',
        'module:src/api',
        'module:src/admin',
      ]),
    );
    expect(snapshot.directionality.crossModuleEdgeCount).toBe(2);
    expect(snapshot.directionality.hasModuleCycle).toBe(false);

    const express = snapshot.claims.find((claim) => claim.id === 'framework:express');
    expect(express).toMatchObject({ confidence: 'detected', type: 'framework_usage' });
    expect(express?.evidence[0]).toMatchObject({ path: 'src/main.ts', line: 1 });

    const serviceNaming = snapshot.claims.find((claim) => claim.id === 'service-naming');
    expect(serviceNaming).toMatchObject({ confidence: 'possible' });
    expect(serviceNaming?.statement).toContain('Names alone are not evidence of microservices');

    const entryClaims = snapshot.claims.filter((claim) => claim.type === 'entry_point_candidate');
    expect(entryClaims).toHaveLength(2);
    expect(snapshot.claims.some((claim) => claim.id === 'deployment:Dockerfile')).toBe(true);

    const microservice = snapshot.claims.find((claim) => claim.id === 'microservice-inference');
    expect(microservice?.confidence).toBe('possible');
    expect(microservice?.statement).toContain('No microservice architecture is claimed');
    expect(snapshot.metrics).toMatchObject({
      frameworkCount: 1,
      entryPointCount: 2,
      deploymentConfigCount: 1,
      networkPackageCount: 1,
    });
    expect(snapshot.basis).toContain('No named architecture style');
  });

  it('withholds a microservice claim when only service naming is present', () => {
    const snapshot = buildArchitectureSnapshot(
      input([
        file('src/services/user.ts', {
          symbols: [
            { name: 'UserService', kind: 'class_declaration', startLine: 1, endLine: 4 },
          ],
        }),
        file('src/index.ts'),
      ]),
    );

    const microservice = snapshot.claims.find((claim) => claim.id === 'microservice-inference');
    expect(microservice?.confidence).toBe('unknown');
    expect(microservice?.statement).toContain('Folders, service-named symbols or imports alone');
    expect(snapshot.metrics.serviceNamingCount).toBe(1);
  });

  it('reports analysis limits explicitly', () => {
    const snapshot = buildArchitectureSnapshot({
      ...input([
        file('src/a.ts', {
          imports: [{ source: 'react', kind: 'static', names: [], line: 1 }],
          truncated: true,
        }),
      ]),
      sourceType: 'zip',
      fileLimitApplied: true,
    });

    expect(snapshot.limits).toEqual(
      expect.arrayContaining([
        expect.stringContaining('file limit was applied'),
        expect.stringContaining('truncated at symbol/import limits'),
        expect.stringContaining('ZIP snapshots have no Git history'),
      ]),
    );
  });
});

describe('compareArchitectureSnapshots', () => {
  it('compares two derived snapshots without treating missing evidence as historical fact', () => {
    const from = buildArchitectureSnapshot(
      input([
        file('src/a.ts'),
        file('Dockerfile', {
          language: null,
          parser: 'unsupported',
          status: 'unsupported',
        }),
      ], 'aaa111'),
    );
    const to = buildArchitectureSnapshot(
      input([file('src/a.ts'), file('src/new/feature.ts')], 'bbb222'),
    );

    const comparison = compareArchitectureSnapshots(from, to);
    expect(comparison.addedModules.map((module) => module.id)).toEqual(['module:src/new']);
    expect(comparison.removedModules.map((module) => module.id)).toEqual(['module:/']);
    expect(comparison.removedClaims.map((claim) => claim.id)).toEqual([
      'deployment:Dockerfile',
      'module:/',
    ]);
    expect(comparison.basis).toContain('not that it did not exist historically');
  });
});
