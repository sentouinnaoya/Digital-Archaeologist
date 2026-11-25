import {
  buildDependencyGraph,
  compareDependencyGraphs,
  type GraphSnapshotInput,
  type GraphSourceFile,
} from '../../src/modules/dependency-analysis/dependency-graph.builder';

function file(path: string, imports: GraphSourceFile['imports'] = []): GraphSourceFile {
  return {
    path,
    language: 'TypeScript',
    parser: 'tree-sitter-typescript',
    status: 'parsed',
    imports,
    modules: [],
    symbols: [],
  };
}

function input(files: GraphSourceFile[]): GraphSnapshotInput {
  return {
    repositoryId: '507f1f77bcf86cd799439011',
    projectId: '507f191e810c19729de860ea',
    commitHash: 'aaa111',
    analyzerVersion: '0.1.0',
    sourceType: 'git_url',
    files,
  };
}

describe('buildDependencyGraph', () => {
  it('builds directed edges only from observed imports and detects a cycle with Tarjan SCC', () => {
    const graph = buildDependencyGraph(
      input([
        file('src/a.ts', [{ source: './b', kind: 'static', names: [], line: 1 }]),
        file('src/b.ts', [{ source: './a', kind: 'commonjs', names: [], line: 4 }]),
        file('src/c.ts', [
          { source: 'react', kind: 'static', names: ['useState'], line: 2 },
          { source: './missing', kind: 'dynamic', names: [], line: 8 },
        ]),
        {
          ...file('src/Demo.java', [
            { source: 'java.util.List', kind: 'java', names: [], line: 2 },
          ]),
          language: 'Java',
          parser: 'tree-sitter-java',
          modules: [{ name: 'com.example', kind: 'namespace', path: null }],
          symbols: [{ name: 'Demo', kind: 'class_declaration', startLine: 3, endLine: 5 }],
        },
      ]),
    );

    expect(graph.edges.map((edge) => [edge.source, edge.target, edge.kind])).toEqual(
      expect.arrayContaining([
        ['file:src/a.ts', 'file:src/b.ts', 'relative'],
        ['file:src/b.ts', 'file:src/a.ts', 'relative'],
        ['file:src/c.ts', 'package:react', 'package'],
        ['file:src/c.ts', 'unresolved:./missing@src/c.ts', 'unresolved'],
        ['file:src/Demo.java', 'package:java.util.List', 'java'],
      ]),
    );
    expect(graph.edges).toHaveLength(5);
    expect(graph.metrics).toMatchObject({
      fileCount: 4,
      packageCount: 2,
      unresolvedCount: 1,
      edgeCount: 5,
      cycleCount: 1,
    });
    expect(graph.cycles[0].nodes).toEqual(['file:src/a.ts', 'file:src/b.ts']);
    expect(graph.cycles[0].evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'src/a.ts', importSource: './b', line: 1 }),
        expect.objectContaining({ path: 'src/b.ts', importSource: './a', line: 4 }),
      ]),
    );

    const nodeA = graph.nodes.find((node) => node.id === 'file:src/a.ts');
    expect(nodeA?.metrics).toMatchObject({ fanIn: 1, fanOut: 1, coupling: 2, instability: 0.5 });
    expect(graph.basis).toContain('observed source-analysis imports');
  });

  it('resolves index files and Java class imports to parsed files', () => {
    const graph = buildDependencyGraph(
      input([
        file('src/app.ts', [{ source: './components', kind: 'static', names: [], line: 1 }]),
        file('src/components/index.ts'),
        {
          ...file('src/Service.java', [
            { source: 'com.example.Other', kind: 'java', names: [], line: 3 },
          ]),
          language: 'Java',
          parser: 'tree-sitter-java',
          modules: [{ name: 'com.example', kind: 'namespace', path: null }],
          symbols: [{ name: 'Service', kind: 'class_declaration', startLine: 4, endLine: 6 }],
        },
        {
          ...file('src/Other.java'),
          language: 'Java',
          parser: 'tree-sitter-java',
          modules: [{ name: 'com.example', kind: 'namespace', path: null }],
          symbols: [{ name: 'Other', kind: 'class_declaration', startLine: 1, endLine: 3 }],
        },
      ]),
    );

    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'file:src/app.ts',
          target: 'file:src/components/index.ts',
          kind: 'relative',
        }),
        expect.objectContaining({
          source: 'file:src/Service.java',
          target: 'file:src/Other.java',
          kind: 'java',
        }),
      ]),
    );
    expect(graph.metrics.unresolvedCount).toBe(0);
  });

  it('detects a self-loop as a cycle', () => {
    const graph = buildDependencyGraph(
      input([
        file('src/self.ts', [{ source: './self', kind: 'static', names: [], line: 1 }]),
      ]),
    );

    expect(graph.cycles).toHaveLength(1);
    expect(graph.cycles[0].nodes).toEqual(['file:src/self.ts']);
  });

  it('compares two graphs without treating missing evidence as historical fact', () => {
    const from = buildDependencyGraph(
      input([
        file('src/a.ts', [{ source: './b', kind: 'static', names: [], line: 1 }]),
        file('src/b.ts'),
      ]),
    );
    const to = buildDependencyGraph(
      input([
        file('src/a.ts'),
        file('src/b.ts'),
        file('src/new.ts', [{ source: 'lodash', kind: 'static', names: [], line: 2 }]),
      ]),
    );

    const comparison = compareDependencyGraphs(from, to);
    expect(comparison.addedNodes.map((node) => node.id)).toEqual(
      expect.arrayContaining(['file:src/new.ts', 'package:lodash']),
    );
    expect(comparison.removedNodes).toEqual([]);
    expect(comparison.addedEdges.map((edge) => edge.id)).toEqual([
      'file:src/new.ts|package:lodash|package',
    ]);
    expect(comparison.removedEdges.map((edge) => edge.id)).toEqual([
      'file:src/a.ts|file:src/b.ts|relative',
    ]);
    expect(comparison.couplingChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ nodeId: 'file:src/a.ts', couplingDelta: -1 }),
        expect.objectContaining({ nodeId: 'file:src/new.ts', couplingDelta: 1 }),
      ]),
    );
    expect(comparison.basis).toContain('not that the file or import did not exist historically');
  });
});
