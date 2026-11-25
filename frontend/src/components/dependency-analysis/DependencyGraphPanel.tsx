'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import {
  useGetProjectSourceAnalysisQuery,
} from '@/store/api/codeAnalysisApi';
import {
  useCompareProjectDependenciesQuery,
  useGetProjectDependenciesQuery,
} from '@/store/api/dependencyApi';
import { useGetProjectCommitsQuery, useGetProjectRepositoryStatusQuery } from '@/store/api/repositoriesApi';
import { Alert, Badge, EmptyState, Skeleton } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { shortHash } from '@/lib/format';
import type {
  DependencyGraph,
  DependencyNode,
  DependencyNodeKind,
  GraphEvidence,
  NodeMetrics,
  SourceFileStatus,
} from '@/lib/types';

type DependencyNodeData = {
  label: string;
  path: string | null;
  kind: DependencyNodeKind;
  status: SourceFileStatus | null;
  metrics: NodeMetrics;
};

type FlowNode = Node<DependencyNodeData, 'dependency'>;

const MAX_NODES = 60;
const MAX_EDGES = 160;
const MAX_DEPTH = 5;
const COLUMN_WIDTH = 260;
const ROW_HEIGHT = 92;

const nodeTypes = { dependency: DependencyNodeCard };

export function DependencyGraphPanel({ projectId }: { projectId: string }) {
  const { data: status } = useGetProjectRepositoryStatusQuery(projectId);
  const repository = status?.repository ?? null;
  const ready = repository?.status === 'ready';
  const isGit = repository?.sourceType === 'git_url';

  const { data: commits } = useGetProjectCommitsQuery(
    { projectId, page: 1, limit: 50 },
    { skip: !isGit },
  );
  const { data: analysis } = useGetProjectSourceAnalysisQuery(projectId, { skip: !ready });

  const [commitHash, setCommitHash] = useState('');
  const [compareFrom, setCompareFrom] = useState('');
  const [compareTo, setCompareTo] = useState('');
  const [comparisonRange, setComparisonRange] = useState<{ from: string; to: string } | null>(null);
  const [selection, setSelection] = useState<{ type: 'node' | 'edge'; id: string } | null>(null);

  const commitOptions = useMemo(() => {
    const hashes = (commits?.data ?? []).map((commit) => commit.hash);
    for (const hash of [repository?.headCommitHash, analysis?.commitHash]) {
      if (hash && !hashes.includes(hash)) hashes.unshift(hash);
    }
    return [...new Set(hashes)].slice(0, 50);
  }, [analysis?.commitHash, commits?.data, repository?.headCommitHash]);

  useEffect(() => {
    if (!ready) return;
    if (!isGit) {
      setCommitHash('snapshot');
      return;
    }
    setCommitHash((current) => current || analysis?.commitHash || repository.headCommitHash || '');
    setCompareFrom((current) => current || commitOptions[1] || '');
    setCompareTo((current) => current || commitOptions[0] || '');
  }, [analysis?.commitHash, commitOptions, commitOptions.length, isGit, ready, repository?.headCommitHash]);

  const graphArgs = { projectId, commitHash: commitHash || undefined };
  const graphReady = ready && Boolean(commitHash);
  const {
    data: graph,
    isLoading,
    error,
  } = useGetProjectDependenciesQuery(graphArgs, { skip: !graphReady });
  const {
    data: comparison,
    isFetching: isComparing,
    error: compareError,
  } = useCompareProjectDependenciesQuery(
    {
      projectId,
      from: comparisonRange?.from ?? '',
      to: comparisonRange?.to ?? '',
    },
    {
      skip:
        !graphReady ||
        !comparisonRange ||
        comparisonRange.from === comparisonRange.to,
    },
  );

  const flow = useMemo(() => (graph ? buildFlowElements(graph) : null), [graph]);

  const selectedNode = selection?.type === 'node'
    ? graph?.nodes.find((node) => node.id === selection.id)
    : undefined;
  const selectedEdge = selection?.type === 'edge'
    ? graph?.edges.find((edge) => edge.id === selection.id)
    : undefined;
  const incidentEdges = selectedNode
    ? (graph?.edges ?? [])
        .filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id)
        .slice(0, 20)
    : [];

  const applyComparison = (event: FormEvent) => {
    event.preventDefault();
    const from = compareFrom.trim();
    const to = compareTo.trim();
    if (!from || !to || from === to) return;
    setComparisonRange({ from, to });
  };

  return (
    <section className="border border-line bg-paper-raised">
      <div className="border-b border-line px-5 py-4">
        <h2 className="font-display text-2xl">Dependency graph</h2>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-ink-soft">
          Directed edges come only from imports observed by source analysis. Relative specifiers are
          resolved against analysed file paths; Java imports are matched to parsed packages and
          classes. Unmatched specifiers remain labelled as external packages or unresolved targets.
        </p>
      </div>

      {!repository ? (
        <div className="p-5">
          <EmptyState
            title="No repository evidence yet"
            description="Import a repository or snapshot and run source analysis before building a dependency graph."
          />
        </div>
      ) : !ready ? (
        <p className="px-5 py-6 text-sm text-ink-soft">
          Dependency visualisation is unavailable while the repository import is {repository.status}.
        </p>
      ) : (
        <>
          <form
            onSubmit={(event) => void applyComparison(event)}
            className="flex flex-wrap items-end gap-3 border-b border-line bg-paper-sunken/40 px-5 py-4"
          >
            {isGit ? (
              <label className="min-w-[18rem] flex-1">
                <span className="mb-1 block font-mono text-[0.65rem] uppercase tracking-[0.12em] text-ink-faint">
                  Analysed commit
                </span>
                <select
                  value={commitHash}
                  onChange={(event) => {
                    setCommitHash(event.target.value);
                    setSelection(null);
                  }}
                  className="w-full border border-line-strong bg-paper-raised px-2 py-2 font-mono text-xs text-ink"
                >
                  {commitOptions.map((hash) => (
                    <option key={hash} value={hash}>
                      {shortHash(hash)}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="flex-1 text-sm text-ink-soft">
                ZIP snapshot <span className="font-mono">{repository.snapshotName}</span> uses the
                single stored analysis point, labelled <span className="font-mono">snapshot</span>.
              </p>
            )}
            {isGit ? (
              <>
                <CommitInput label="From" value={compareFrom} onChange={setCompareFrom} />
                <CommitInput label="To" value={compareTo} onChange={setCompareTo} />
                <Button type="submit" disabled={!compareFrom.trim() || !compareTo.trim() || compareFrom.trim() === compareTo.trim() || isComparing}>
                  {isComparing ? 'Comparing…' : 'Compare commits'}
                </Button>
              </>
            ) : null}
          </form>

          {error ? (
            <div className="p-5">
              <Alert tone="info">
                No stored source analysis is available for this point. Run source analysis first.
              </Alert>
            </div>
          ) : isLoading ? (
            <div className="p-5">
              <Skeleton className="h-[28rem] w-full" />
            </div>
          ) : graph && flow ? (
            <>
              <div className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-[0.7rem] text-ink-soft">
                    {shortHash(graph.commitHash)} · {graph.analyzerVersion} · {graph.sourceType}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="active">{graph.metrics.fileCount} files</Badge>
                    <Badge>{graph.metrics.edgeCount} edges</Badge>
                    {graph.metrics.cycleCount > 0 ? (
                      <Badge tone="warning">{graph.metrics.cycleCount} cycles</Badge>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  <Metric label="Nodes" value={graph.metrics.nodeCount} />
                  <Metric label="Packages" value={graph.metrics.packageCount} />
                  <Metric label="Unresolved" value={graph.metrics.unresolvedCount} />
                  <Metric label="Avg coupling" value={graph.metrics.averageCoupling} />
                  <Metric label="Max fan-in" value={graph.metrics.maxFanIn} />
                  <Metric label="Max fan-out" value={graph.metrics.maxFanOut} />
                </div>

                {flow.hiddenNodeCount > 0 || flow.hiddenEdgeCount > 0 ? (
                  <p className="mt-3 font-mono text-[0.65rem] text-ink-faint">
                    Displaying {flow.nodes.length} of {graph.nodes.length} nodes and{' '}
                    {flow.edges.length} of {graph.edges.length} edges, prioritising cycles and
                    coupling. No additional relationships are inferred.
                  </p>
                ) : null}
              </div>

              <div className="h-[34rem] border-y border-line bg-paper-sunken/30">
                <ReactFlow
                  nodes={flow.nodes}
                  edges={flow.edges}
                  nodeTypes={nodeTypes}
                  onNodeClick={(_, node) => setSelection({ type: 'node', id: node.id })}
                  onEdgeClick={(_, edge) => setSelection({ type: 'edge', id: edge.id })}
                  onPaneClick={() => setSelection(null)}
                  fitView
                  proOptions={{ hideAttribution: true }}
                >
                  <Background color="#d8d1c2" gap={22} size={1} />
                  <Controls showInteractive={false} />
                  <MiniMap
                    nodeColor={(node) =>
                      node.data?.kind === 'file' ? '#4d6b52' : '#bdb3a0'
                    }
                    pannable
                    zoomable
                  />
                </ReactFlow>
              </div>

              <div className="grid gap-4 p-5 lg:grid-cols-2">
                <div>
                  <h3 className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-ink-faint">
                    Evidence inspector
                  </h3>
                  {selectedNode ? (
                    <div className="mt-2 border border-line bg-paper-sunken/30 p-3 text-xs">
                      <p className="break-all font-mono text-ink">{selectedNode.id}</p>
                      <p className="mt-1 text-ink-soft">
                        {selectedNode.language ?? 'Unknown language'} · fan-in{' '}
                        {selectedNode.metrics.fanIn} · fan-out {selectedNode.metrics.fanOut} ·
                        instability {selectedNode.metrics.instability}
                      </p>
                      <p className="mt-3 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-ink-faint">
                        Incident imports ({incidentEdges.length})
                      </p>
                      <EvidenceList evidence={incidentEdges.flatMap((edge) => edge.evidence)} />
                    </div>
                  ) : selectedEdge ? (
                    <div className="mt-2 border border-line bg-paper-sunken/30 p-3 text-xs">
                      <p className="break-all font-mono text-ink">{selectedEdge.id}</p>
                      <p className="mt-1 text-ink-soft">
                        {selectedEdge.source} → {selectedEdge.target} · {selectedEdge.kind}
                      </p>
                      <p className="mt-3 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-ink-faint">
                        Observed evidence ({selectedEdge.evidence.length})
                      </p>
                      <EvidenceList evidence={selectedEdge.evidence} />
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-ink-soft">
                      Select a node or edge to inspect the source imports that produced it.
                    </p>
                  )}
                </div>

                <div>
                  <h3 className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-ink-faint">
                    Detected cycles ({graph.cycles.length})
                  </h3>
                  {graph.cycles.length === 0 ? (
                    <p className="mt-2 text-xs text-ink-soft">
                      No directed cycle was detected in this analysed file set.
                    </p>
                  ) : (
                    <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto">
                      {graph.cycles.map((cycle) => (
                        <li key={cycle.id} className="border border-line bg-paper-sunken/30 p-3 text-xs">
                          <button
                            type="button"
                            className="break-all text-left font-mono text-ink hover:text-clay"
                            onClick={() => {
                              if (cycle.edges[0]) setSelection({ type: 'edge', id: cycle.edges[0] });
                            }}
                          >
                            {cycle.nodes.map((id) => id.replace(/^file:/, '')).join(' → ')}
                          </button>
                          <p className="mt-1 text-ink-faint">{cycle.evidence.length} evidence lines</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {compareError ? (
                <div className="px-5 pb-5">
                  <Alert>Both commits need stored source analysis before they can be compared.</Alert>
                </div>
              ) : comparison ? (
                <div className="border-t border-line px-5 py-4">
                  <h3 className="font-display text-lg">
                    Change {shortHash(comparison.fromCommitHash)} →{' '}
                    {shortHash(comparison.toCommitHash)}
                  </h3>
                  <div className="mt-2 grid gap-2 sm:grid-cols-4">
                    <Metric label="Added nodes" value={comparison.addedNodes.length} />
                    <Metric label="Removed nodes" value={comparison.removedNodes.length} />
                    <Metric label="Added edges" value={comparison.addedEdges.length} />
                    <Metric label="Removed edges" value={comparison.removedEdges.length} />
                  </div>
                  {comparison.couplingChanges.length > 0 ? (
                    <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto font-mono text-[0.7rem]">
                      {comparison.couplingChanges.slice(0, 20).map((change) => (
                        <li key={change.nodeId} className="break-all">
                          {change.nodeId}: {change.before.coupling} → {change.after.coupling} (
                          {change.couplingDelta > 0 ? '+' : ''}
                          {change.couplingDelta})
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-xs text-ink-soft">No coupling changes were observed.</p>
                  )}
                  <p className="mt-3 text-xs leading-relaxed text-ink-soft">{comparison.basis}</p>
                </div>
              ) : null}

              <div className="border-t border-line px-5 py-4">
                <p className="text-xs leading-relaxed text-ink-soft">{graph.basis}</p>
              </div>
            </>
          ) : (
            <p className="px-5 py-6 text-sm text-ink-soft">
              Run source analysis to record the imports this graph requires.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function CommitInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="min-w-[10rem] flex-1">
      <span className="mb-1 block font-mono text-[0.65rem] uppercase tracking-[0.12em] text-ink-faint">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Commit hash"
        className="w-full border border-line-strong bg-paper-raised px-2 py-2 font-mono text-xs text-ink"
      />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-line bg-paper-sunken/40 px-3 py-2">
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink-faint">{label}</p>
      <p className="mt-1 font-display text-xl text-ink">{value}</p>
    </div>
  );
}

function EvidenceList({
  evidence,
  edges,
}: {
  evidence?: GraphEvidence[];
  edges?: Array<{ source: string; target: string; evidence: GraphEvidence[] }>;
}) {
  const items: Array<{ key: string; path: string; evidence: GraphEvidence }> = [];
  if (evidence) {
    evidence.slice(0, 20).forEach((item, index) =>
      items.push({ key: `e-${index}`, path: '', evidence: item }),
    );
  }
  if (edges) {
    edges.forEach((edge, edgeIndex) =>
      edge.evidence.slice(0, 5).forEach((item, index) =>
        items.push({ key: `${edgeIndex}-${index}`, path: `${edge.source} → ${edge.target}`, evidence: item }),
      ),
    );
  }
  if (items.length === 0) {
    return <p className="mt-1 text-ink-faint">No observed evidence.</p>;
  }
  return (
    <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto font-mono">
      {items.map(({ key, path, evidence: item }) => (
        <li key={key} className="break-all">
          {path ? <span className="text-ink-faint">{path} · </span> : null}
          {item.path}:{item.line} {item.importSource}
        </li>
      ))}
    </ul>
  );
}

function DependencyNodeCard({ data, selected }: NodeProps<FlowNode>) {
  const tone =
    data.kind === 'file'
      ? 'border-moss/50 bg-paper-raised'
      : data.kind === 'unresolved'
        ? 'border-alert/50 bg-alert/5'
        : 'border-line-strong bg-paper-sunken/50';
  return (
    <div
      className={`w-[200px] border px-3 py-2 ${tone} ${selected ? 'ring-2 ring-clay' : ''}`}
      title={data.path ?? data.label}
    >
      <Handle type="target" position={Position.Left} />
      <p className="break-all font-mono text-[0.7rem] text-ink">{data.label}</p>
      <p className="mt-1 font-mono text-[0.6rem] text-ink-faint">
        in {data.metrics.fanIn} · out {data.metrics.fanOut}
        {data.status && data.status !== 'parsed' ? ` · ${data.status.replaceAll('_', ' ')}` : ''}
      </p>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function buildFlowElements(graph: DependencyGraph): {
  nodes: FlowNode[];
  edges: Edge[];
  hiddenNodeCount: number;
  hiddenEdgeCount: number;
} {
  const cycleEdgeIds = new Set(graph.cycles.flatMap((cycle) => cycle.edges));
  const cycleNodeIds = new Set(graph.cycles.flatMap((cycle) => cycle.nodes));
  const ranked = [...graph.nodes].sort(
    (left, right) =>
      right.metrics.coupling - left.metrics.coupling || left.id.localeCompare(right.id),
  );

  const included = new Set<string>();
  for (const id of cycleNodeIds) {
    if (included.size < MAX_NODES) included.add(id);
  }
  for (const node of ranked) {
    if (included.size < MAX_NODES) included.add(node.id);
  }
  for (const edge of graph.edges) {
    if (included.size >= MAX_NODES + 20) break;
    if (included.has(edge.source) && !included.has(edge.target)) included.add(edge.target);
  }

  const visibleNodes = graph.nodes.filter((node) => included.has(node.id));
  const visibleIds = new Set(visibleNodes.map((node) => node.id));
  const visibleEdges = graph.edges
    .filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target))
    .sort(
      (left, right) =>
        Number(cycleEdgeIds.has(right.id)) - Number(cycleEdgeIds.has(left.id)) ||
        right.evidence.length - left.evidence.length ||
        left.id.localeCompare(right.id),
    )
    .slice(0, MAX_EDGES);

  const outgoing = new Map<string, string[]>();
  for (const edge of visibleEdges) {
    const targets = outgoing.get(edge.source) ?? [];
    targets.push(edge.target);
    outgoing.set(edge.source, targets);
  }
  const depth = new Map<string, number>();
  const queue: string[] = [];
  for (const node of visibleNodes) {
    if (!graph.edges.some((edge) => edge.target === node.id && visibleIds.has(edge.source))) {
      depth.set(node.id, 0);
      queue.push(node.id);
    }
  }
  let cursor = 0;
  let guard = 0;
  while (cursor < queue.length && guard < visibleNodes.length * 4) {
    const id = queue[cursor];
    cursor += 1;
    guard += 1;
    const current = depth.get(id) ?? 0;
    for (const target of outgoing.get(id) ?? []) {
      const candidate = Math.min(MAX_DEPTH, current + 1);
      if ((depth.get(target) ?? -1) < candidate) {
        depth.set(target, candidate);
        queue.push(target);
      }
    }
  }
  for (const node of visibleNodes) {
    if (!depth.has(node.id)) depth.set(node.id, MAX_DEPTH);
  }

  const groups = new Map<number, DependencyNode[]>();
  for (const node of visibleNodes) {
    const level = depth.get(node.id) ?? 0;
    const group = groups.get(level) ?? [];
    group.push(node);
    groups.set(level, group);
  }

  const nodes: FlowNode[] = [];
  for (const [level, group] of [...groups.entries()].sort(([a], [b]) => a - b)) {
    group.sort((left, right) => left.id.localeCompare(right.id));
    const offset = ((group.length - 1) * ROW_HEIGHT) / 2;
    group.forEach((node, index) => {
      nodes.push({
        id: node.id,
        type: 'dependency',
        position: { x: level * COLUMN_WIDTH, y: 320 + index * ROW_HEIGHT - offset },
        data: {
          label: node.label,
          path: node.path,
          kind: node.kind,
          status: node.status,
          metrics: node.metrics,
        },
      });
    });
  }

  const edges: Edge[] = visibleEdges.map((edge) => {
    const isCycle = cycleEdgeIds.has(edge.id);
    const color = edgeColor(edge.kind, isCycle);
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      label: edge.evidence[0]?.importSource ?? edge.kind,
      animated: isCycle,
      style: { stroke: color, strokeWidth: isCycle ? 2.4 : 1.4 },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
      labelStyle: { fill: '#23211d', fontSize: 10, fontFamily: 'monospace' },
      labelBgStyle: { fill: '#fffdf8', fillOpacity: 0.92 },
      labelBgPadding: [4, 2],
      labelBgBorderRadius: 2,
    };
  });

  return {
    nodes,
    edges,
    hiddenNodeCount: graph.nodes.length - nodes.length,
    hiddenEdgeCount: graph.edges.length - edges.length,
  };
}

function edgeColor(kind: string, isCycle: boolean): string {
  if (isCycle) return '#9c3b2e';
  if (kind === 'relative') return '#4d6b52';
  if (kind === 'java') return '#a4562f';
  if (kind === 'unresolved') return '#9c3b2e';
  return '#8b857a';
}
