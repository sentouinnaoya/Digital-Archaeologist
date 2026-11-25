import Graph from 'graphology';
import { posix } from 'node:path';
import type {
  SourceImport,
  SourceModule,
  SourceSymbol,
  SourceFileStatus,
} from '../code-analysis/source-parser';

export interface GraphSourceFile {
  path: string;
  language: string | null;
  parser: string;
  status: SourceFileStatus;
  imports: SourceImport[];
  modules: SourceModule[];
  symbols: SourceSymbol[];
  truncated?: boolean;
}

export interface GraphSnapshotInput {
  repositoryId: string;
  projectId: string;
  commitHash: string;
  analyzerVersion: string;
  sourceType: 'git_url' | 'zip';
  files: GraphSourceFile[];
}

export interface GraphEvidence {
  path: string;
  line: number;
  importSource: string;
  detail: string;
}

export interface NodeMetrics {
  fanIn: number;
  fanOut: number;
  coupling: number;
  instability: number;
}

export type DependencyNodeKind = 'file' | 'package' | 'unresolved';

export interface DependencyNode {
  id: string;
  kind: DependencyNodeKind;
  label: string;
  path: string | null;
  language: string | null;
  parser: string | null;
  status: SourceFileStatus | null;
  metrics: NodeMetrics;
}

export type DependencyEdgeKind = 'relative' | 'package' | 'java' | 'unresolved';

export interface DependencyEdge {
  id: string;
  source: string;
  target: string;
  kind: DependencyEdgeKind;
  evidence: GraphEvidence[];
}

export interface DependencyCycle {
  id: string;
  nodes: string[];
  edges: string[];
  evidence: GraphEvidence[];
}

export interface GraphMetrics {
  nodeCount: number;
  fileCount: number;
  packageCount: number;
  unresolvedCount: number;
  edgeCount: number;
  cycleCount: number;
  averageCoupling: number;
  maxFanIn: number;
  maxFanOut: number;
}

export interface DependencyGraph {
  repositoryId: string;
  projectId: string;
  commitHash: string;
  analyzerVersion: string;
  sourceType: 'git_url' | 'zip';
  basis: string;
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  cycles: DependencyCycle[];
  metrics: GraphMetrics;
}

export interface GraphComparison {
  fromCommitHash: string;
  toCommitHash: string;
  basis: string;
  addedNodes: DependencyNode[];
  removedNodes: DependencyNode[];
  addedEdges: DependencyEdge[];
  removedEdges: DependencyEdge[];
  couplingChanges: Array<{
    nodeId: string;
    before: NodeMetrics;
    after: NodeMetrics;
    couplingDelta: number;
  }>;
}

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.java'];

export function buildDependencyGraph(input: GraphSnapshotInput): DependencyGraph {
  const files = [...input.files].sort((left, right) => left.path.localeCompare(right.path));
  const fileIds = new Set(files.map((file) => `file:${file.path}`));
  const pathIndex = buildPathIndex(files);
  const nodes = new Map<string, DependencyNode>();
  const edges = new Map<string, DependencyEdge>();

  for (const file of files) {
    const id = `file:${file.path}`;
    nodes.set(id, {
      id,
      kind: 'file',
      label: file.path,
      path: file.path,
      language: file.language,
      parser: file.parser,
      status: file.status,
      metrics: { fanIn: 0, fanOut: 0, coupling: 0, instability: 0 },
    });
  }

  for (const file of files) {
    const sourceId = `file:${file.path}`;
    for (const item of file.imports) {
      if (!item.source) continue;
      const resolution = resolveImport(file.path, item, pathIndex);
      const edge = {
        source: sourceId,
        target: resolution.targetId,
        kind: resolution.kind,
        evidence: {
          path: file.path,
          line: item.line,
          importSource: item.source,
          detail: resolution.detail,
        },
      };
      const edgeId = `${edge.source}|${edge.target}|${edge.kind}`;
      const existing = edges.get(edgeId);
      if (existing) {
        existing.evidence.push(edge.evidence);
        continue;
      }
      edges.set(edgeId, { id: edgeId, ...edge, evidence: [edge.evidence] });

      if (resolution.targetKind !== 'file' && !nodes.has(resolution.targetId)) {
        nodes.set(resolution.targetId, {
          id: resolution.targetId,
          kind: resolution.targetKind,
          label: resolution.label,
          path: null,
          language: null,
          parser: null,
          status: null,
          metrics: { fanIn: 0, fanOut: 0, coupling: 0, instability: 0 },
        });
      }
    }
  }

  applyMetrics(nodes, edges);
  const graph = createGraphologyGraph(nodes, edges);
  const cycles = findCycles(graph, fileIds, edges);

  const nodeList = [...nodes.values()].sort((left, right) => left.id.localeCompare(right.id));
  const edgeList = [...edges.values()].sort((left, right) => left.id.localeCompare(right.id));
  const fileNodes = nodeList.filter((node) => node.kind === 'file');

  return {
    repositoryId: input.repositoryId,
    projectId: input.projectId,
    commitHash: input.commitHash,
    analyzerVersion: input.analyzerVersion,
    sourceType: input.sourceType,
    basis:
      'Directed graph built only from observed source-analysis imports. Relative specifiers are resolved against analysed file paths; Java imports are matched to parsed packages/classes. Unmatched specifiers and packages are labelled, not inferred. Coupling values are graph fan-in/fan-out counts, not architectural quality claims.',
    nodes: nodeList,
    edges: edgeList,
    cycles,
    metrics: {
      nodeCount: nodeList.length,
      fileCount: fileNodes.length,
      packageCount: nodeList.filter((node) => node.kind === 'package').length,
      unresolvedCount: nodeList.filter((node) => node.kind === 'unresolved').length,
      edgeCount: edgeList.length,
      cycleCount: cycles.length,
      averageCoupling: average(
        fileNodes.map((node) => node.metrics.coupling),
        2,
      ),
      maxFanIn: Math.max(0, ...fileNodes.map((node) => node.metrics.fanIn)),
      maxFanOut: Math.max(0, ...fileNodes.map((node) => node.metrics.fanOut)),
    },
  };
}

export function compareDependencyGraphs(
  from: DependencyGraph,
  to: DependencyGraph,
): GraphComparison {
  const fromNodes = new Map(from.nodes.map((node) => [node.id, node]));
  const toNodes = new Map(to.nodes.map((node) => [node.id, node]));
  const fromEdges = new Map(from.edges.map((edge) => [edge.id, edge]));
  const toEdges = new Map(to.edges.map((edge) => [edge.id, edge]));

  const couplingChanges = to.nodes
    .filter((node) => node.kind === 'file')
    .map((node) => {
      const before = fromNodes.get(node.id)?.metrics ?? {
        fanIn: 0,
        fanOut: 0,
        coupling: 0,
        instability: 0,
      };
      return {
        nodeId: node.id,
        before,
        after: node.metrics,
        couplingDelta: node.metrics.coupling - before.coupling,
      };
    })
    .filter((change) => change.couplingDelta !== 0);

  return {
    fromCommitHash: from.commitHash,
    toCommitHash: to.commitHash,
    basis:
      'Difference between two deterministic graphs built from stored source analyses. A missing graph node or edge means it was absent from that analysis, not that the file or import did not exist historically.',
    addedNodes: to.nodes.filter((node) => !fromNodes.has(node.id)),
    removedNodes: from.nodes.filter((node) => !toNodes.has(node.id)),
    addedEdges: to.edges.filter((edge) => !fromEdges.has(edge.id)),
    removedEdges: from.edges.filter((edge) => !toEdges.has(edge.id)),
    couplingChanges,
  };
}

function buildPathIndex(files: GraphSourceFile[]): Map<string, string | null> {
  const index = new Map<string, string | null>();
  const add = (key: string, fileId: string) => {
    const existing = index.get(key);
    if (existing === undefined) index.set(key, fileId);
    else if (existing !== fileId) index.set(key, null);
  };

  for (const file of files) {
    const fileId = `file:${file.path}`;
    const normalized = normalizePath(file.path);
    add(normalized, fileId);
    const withoutExtension = normalized.replace(/\.[^./]+$/, '');
    add(withoutExtension, fileId);
    if (posix.basename(withoutExtension) === 'index') {
      add(posix.dirname(withoutExtension) === '.' ? '' : posix.dirname(withoutExtension), fileId);
    }

    const namespace = file.modules.find((module) => module.kind === 'namespace')?.name;
    const classNames = file.symbols
      .filter((symbol) =>
        ['class_declaration', 'interface_declaration', 'enum_declaration', 'record_declaration'].includes(
          symbol.kind,
        ),
      )
      .map((symbol) => symbol.name);
    for (const className of classNames) {
      add(className, fileId);
      if (namespace) add(`${namespace}.${className}`, fileId);
    }
  }
  return index;
}

function resolveImport(
  fromPath: string,
  item: SourceImport,
  index: Map<string, string | null>,
): {
  targetId: string;
  targetKind: DependencyNodeKind;
  kind: DependencyEdgeKind;
  label: string;
  detail: string;
} {
  const source = item.source;

  if (item.kind === 'java') {
    const targetId = source.replace(/\.\*$/, '');
    const matched = index.get(targetId) ?? index.get(posix.basename(targetId));
    if (matched) {
      return {
        targetId: matched,
        targetKind: 'file',
        kind: 'java',
        label: matched,
        detail: `Java import ${source} matched a parsed file`,
      };
    }
    return {
      targetId: `package:${targetId}`,
      targetKind: 'package',
      kind: 'java',
      label: targetId,
      detail: `Java import ${source} had no matching parsed file`,
    };
  }

  if (source.startsWith('.')) {
    const base = posix.dirname(fromPath) === '.' ? '' : posix.dirname(fromPath);
    const candidate = normalizePath(posix.join(base, source));
    const options = [candidate, ...EXTENSIONS.map((extension) => `${candidate}${extension}`)];
    if (posix.basename(candidate) !== 'index') {
      options.push(...EXTENSIONS.map((extension) => `${candidate}/index${extension}`));
    }
    const matched = options.map((option) => index.get(option)).find(Boolean);
    if (matched) {
      return {
        targetId: matched,
        targetKind: 'file',
        kind: 'relative',
        label: matched,
        detail: `${item.kind} import ${source} resolved to ${matched.slice(5)}`,
      };
    }
    return {
      targetId: `unresolved:${source}@${fromPath}`,
      targetKind: 'unresolved',
      kind: 'unresolved',
      label: source,
      detail: `${item.kind} import ${source} could not be matched to an analysed file`,
    };
  }

  return {
    targetId: `package:${source}`,
    targetKind: 'package',
    kind: 'package',
    label: source,
    detail: `${item.kind} import ${source} is an external package specifier`,
  };
}

function normalizePath(path: string): string {
  return posix
    .normalize(path.replaceAll('\\', '/'))
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .replace(/\/$/, '');
}

function applyMetrics(
  nodes: Map<string, DependencyNode>,
  edges: Map<string, DependencyEdge>,
): void {
  const fanIn = new Map<string, number>();
  const fanOut = new Map<string, number>();
  for (const edge of edges.values()) {
    fanOut.set(edge.source, (fanOut.get(edge.source) ?? 0) + 1);
    fanIn.set(edge.target, (fanIn.get(edge.target) ?? 0) + 1);
  }
  for (const node of nodes.values()) {
    const incoming = fanIn.get(node.id) ?? 0;
    const outgoing = fanOut.get(node.id) ?? 0;
    const coupling = incoming + outgoing;
    node.metrics = {
      fanIn: incoming,
      fanOut: outgoing,
      coupling,
      instability: coupling === 0 ? 0 : round(outgoing / coupling, 2),
    };
  }
}

function createGraphologyGraph(
  nodes: Map<string, DependencyNode>,
  edges: Map<string, DependencyEdge>,
): Graph {
  const graph = new Graph({ type: 'directed' });
  for (const node of nodes.values()) graph.addNode(node.id, node);
  for (const edge of edges.values()) {
    graph.addDirectedEdgeWithKey(edge.id, edge.source, edge.target, edge);
  }
  return graph;
}

function findCycles(
  graph: Graph,
  fileIds: Set<string>,
  edges: Map<string, DependencyEdge>,
): DependencyCycle[] {
  let nextIndex = 0;
  const indices = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const components: string[][] = [];

  const visit = (nodeId: string): void => {
    indices.set(nodeId, nextIndex);
    lowLinks.set(nodeId, nextIndex);
    nextIndex += 1;
    stack.push(nodeId);
    onStack.add(nodeId);

    for (const neighbor of graph.outNeighbors(nodeId)) {
      if (!fileIds.has(neighbor)) continue;
      if (!indices.has(neighbor)) {
        visit(neighbor);
        lowLinks.set(nodeId, Math.min(lowLinks.get(nodeId)!, lowLinks.get(neighbor)!));
      } else if (onStack.has(neighbor)) {
        lowLinks.set(nodeId, Math.min(lowLinks.get(nodeId)!, indices.get(neighbor)!));
      }
    }

    if (lowLinks.get(nodeId) !== indices.get(nodeId)) return;
    const component: string[] = [];
    let member: string;
    do {
      member = stack.pop()!;
      onStack.delete(member);
      component.push(member);
    } while (member !== nodeId);
    components.push(component.sort((left, right) => left.localeCompare(right)));
  };

  for (const nodeId of [...fileIds].sort()) {
    if (!indices.has(nodeId)) visit(nodeId);
  }

  return components
    .filter((component) => {
      if (component.length > 1) return true;
      const id = component[0];
      return [...edges.values()].some((edge) => edge.source === id && edge.target === id);
    })
    .map((component) => {
      const members = new Set(component);
      const componentEdges = [...edges.values()]
        .filter((edge) => members.has(edge.source) && members.has(edge.target))
        .sort((left, right) => left.id.localeCompare(right.id));
      return {
        id: `cycle:${component.join('|')}`,
        nodes: component,
        edges: componentEdges.map((edge) => edge.id),
        evidence: componentEdges.flatMap((edge) => edge.evidence),
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

function average(values: number[], decimals: number): number {
  if (values.length === 0) return 0;
  return round(values.reduce((total, value) => total + value, 0) / values.length, decimals);
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
