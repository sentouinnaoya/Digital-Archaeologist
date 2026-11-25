import {
  buildCommitComparison,
  buildSourceFileDiff,
  type ComparisonCommit,
} from '../../src/modules/historical-comparison/comparison.builder';
import type { ParsedSourceFileRecord } from '../../src/modules/code-analysis/schemas/analysis-snapshot.schema';
import type { GraphComparison } from '../../src/modules/dependency-analysis/dependency-graph.builder';
import type { ReconstructedStructure } from '../../src/modules/timeline/structure.builder';

function commit(hash: string): ComparisonCommit {
  return {
    hash,
    message: `Commit ${hash}`,
    authorName: 'Ada',
    authorEmail: 'ada@example.com',
    authoredAt: '2026-01-01T00:00:00.000Z',
    committedAt: '2026-01-01T00:00:00.000Z',
    parentHashes: [],
    fileChanges: [],
  };
}

function structure(
  atCommitHash: string,
  paths: string[],
): ReconstructedStructure {
  return {
    repositoryId: 'repo',
    atCommitHash,
    analyzedCommitCount: 1,
    fileCount: paths.length,
    confidence: 'detected',
    basis: 'test',
    root: {
      path: '',
      name: '',
      type: 'directory',
      lastObservedCommitHash: null,
      lastObservedStatus: null,
      children: paths.map((path) => ({
        path,
        name: path.split('/').pop() ?? path,
        type: 'file',
        lastObservedCommitHash: atCommitHash,
        lastObservedStatus: 'A',
        children: [],
      })),
    },
  };
}

function parsedFile(
  path: string,
  symbols: Array<{ name: string; kind: string; startLine: number }>,
): ParsedSourceFileRecord {
  return {
    path,
    language: 'TypeScript',
    parser: 'tree-sitter-typescript',
    status: 'parsed',
    size: 10,
    symbols: symbols.map((symbol) => ({ ...symbol, endLine: symbol.startLine })),
    imports: [],
    modules: [],
    syntaxErrors: [],
    truncated: false,
  };
}

describe('buildCommitComparison', () => {
  it('derives file, structure and symbol evidence from two analysed commits', () => {
    const dependencies = {
      fromCommitHash: 'aaa111',
      toCommitHash: 'bbb222',
      basis: 'test graph comparison',
      addedNodes: [],
      removedNodes: [],
      addedEdges: [],
      removedEdges: [],
      couplingChanges: [],
    } as GraphComparison;

    const result = buildCommitComparison({
      fromCommit: commit('aaa111'),
      toCommit: commit('bbb222'),
      fileChanges: [{ status: 'A', path: 'src/new.ts' }],
      fromStructure: structure('aaa111', ['src/a.ts', 'src/old.ts']),
      toStructure: structure('bbb222', ['src/a.ts', 'src/new.ts']),
      fromFiles: [parsedFile('src/a.ts', [{ name: 'Old', kind: 'class_declaration', startLine: 1 }])],
      toFiles: [parsedFile('src/a.ts', [{ name: 'New', kind: 'class_declaration', startLine: 3 }])],
      dependencies,
      limits: ['test limit'],
    });

    expect(result.fileChanges).toEqual([{ status: 'A', path: 'src/new.ts' }]);
    expect(result.structure.addedPaths).toEqual(['src/new.ts']);
    expect(result.structure.removedPaths).toEqual(['src/old.ts']);
    expect(result.structure.retainedPathCount).toBe(1);
    expect(result.symbols).toMatchObject({
      added: [{ path: 'src/a.ts', name: 'New', kind: 'class_declaration', line: 3 }],
      removed: [{ path: 'src/a.ts', name: 'Old', kind: 'class_declaration', line: 1 }],
    });
    expect(result.dependencies).toBe(dependencies);
    expect(result.limits).toEqual(['test limit']);
    expect(result.basis).toContain('not that it never existed');
  });

  it('labels symbol and dependency diffs unavailable when analyses are missing', () => {
    const result = buildCommitComparison({
      fromCommit: commit('aaa111'),
      toCommit: commit('bbb222'),
      fileChanges: [],
      fromStructure: structure('aaa111', ['src/a.ts']),
      toStructure: structure('bbb222', ['src/a.ts']),
      limits: ['No stored analysis at one commit'],
    });

    expect(result.symbols).toBeNull();
    expect(result.dependencies).toBeNull();
  });
});

describe('buildSourceFileDiff', () => {
  it('pairs removed and added lines into changed rows', () => {
    const result = buildSourceFileDiff({
      path: 'src/a.ts',
      fromCommitHash: 'aaa111',
      toCommitHash: 'bbb222',
      fromContent: 'const a = 1;\nconst keep = true;\nconst gone = 2;',
      toContent: 'const a = 2;\nconst keep = true;\nconst added = 3;',
      fromExists: true,
      toExists: true,
      maxLines: 100,
    });

    expect(result.rows).toEqual([
      expect.objectContaining({ kind: 'changed', left: 'const a = 1;', right: 'const a = 2;' }),
      expect.objectContaining({ kind: 'context', left: 'const keep = true;', right: 'const keep = true;' }),
      expect.objectContaining({ kind: 'changed', left: 'const gone = 2;', right: 'const added = 3;' }),
    ]);
    expect(result.fromExists).toBe(true);
    expect(result.toExists).toBe(true);
    expect(result.truncated).toBe(false);
    expect(result.basis).toContain('not stored in MongoDB');
  });

  it('marks added files and truncated comparisons explicitly', () => {
    const result = buildSourceFileDiff({
      path: 'src/new.ts',
      fromCommitHash: 'aaa111',
      toCommitHash: 'bbb222',
      fromContent: null,
      toContent: 'one\ntwo\nthree',
      fromExists: false,
      toExists: true,
      maxLines: 2,
    });

    expect(result.rows).toHaveLength(2);
    expect(result.rows.every((row) => row.kind === 'added')).toBe(true);
    expect(result.truncated).toBe(true);
    expect(result.limits).toEqual(
      expect.arrayContaining([
        expect.stringContaining('first 2 lines'),
        expect.stringContaining('absent from the first commit'),
      ]),
    );
  });
});
