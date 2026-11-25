'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  useCompareProjectArchitectureQuery,
  useGetProjectArchitectureQuery,
} from '@/store/api/architectureApi';
import { useGetProjectSourceAnalysisQuery } from '@/store/api/codeAnalysisApi';
import {
  useGetProjectCommitsQuery,
  useGetProjectRepositoryStatusQuery,
} from '@/store/api/repositoriesApi';
import { Alert, Badge, EmptyState, Skeleton } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { shortHash } from '@/lib/format';
import type {
  ArchitectureClaim,
  ArchitectureConfidence,
  ArchitectureEvidence,
  ArchitectureModule,
} from '@/lib/types';

const MAX_MODULES = 16;
const MAX_CLAIMS = 12;
const MAX_LIST_ITEMS = 8;

export function ArchitecturePanel({ projectId }: { projectId: string }) {
  const { data: status } = useGetProjectRepositoryStatusQuery(projectId);
  const repository = status?.repository ?? null;
  const ready = repository?.status === 'ready';
  const isGit = repository?.sourceType === 'git_url';

  const { data: commits } = useGetProjectCommitsQuery(
    { projectId, page: 1, limit: 50 },
    { skip: !ready || !isGit },
  );
  const { data: analysis } = useGetProjectSourceAnalysisQuery(projectId, { skip: !ready });

  const [commitHash, setCommitHash] = useState('');
  const [compareFrom, setCompareFrom] = useState('');
  const [compareTo, setCompareTo] = useState('');
  const [comparisonRange, setComparisonRange] = useState<{ from: string; to: string } | null>(null);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);

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
    setCommitHash((current) => current || analysis?.commitHash || repository?.headCommitHash || '');
    setCompareFrom((current) => current || commitOptions[1] || '');
    setCompareTo((current) => current || commitOptions[0] || '');
  }, [analysis?.commitHash, commitOptions, isGit, ready, repository?.headCommitHash]);

  const architectureReady = ready && Boolean(commitHash);
  const {
    data: architecture,
    isLoading,
    error,
  } = useGetProjectArchitectureQuery(
    { projectId, commitHash: commitHash || undefined },
    { skip: !architectureReady },
  );
  const {
    data: comparison,
    isFetching: isComparing,
    error: compareError,
  } = useCompareProjectArchitectureQuery(
    {
      projectId,
      from: comparisonRange?.from ?? '',
      to: comparisonRange?.to ?? '',
    },
    {
      skip:
        !architectureReady ||
        !comparisonRange ||
        comparisonRange.from === comparisonRange.to,
    },
  );

  const visibleModules = architecture?.modules.slice(0, MAX_MODULES) ?? [];
  const visibleClaims = architecture?.claims.slice(0, MAX_CLAIMS) ?? [];
  const selectedClaim = architecture?.claims.find((claim) => claim.id === selectedClaimId);

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
        <h2 className="font-display text-2xl">Architecture evidence</h2>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-ink-soft">
          Module boundaries, import direction and framework usage are derived from stored paths,
          symbols and imports, then labelled with a confidence level. No named architecture style
          or deployed topology is claimed. A microservice claim is withheld unless separate entry
          points, deployment configuration, service boundaries and network communication are all
          observed together.
        </p>
      </div>

      {!repository ? (
        <div className="p-5">
          <EmptyState
            title="No repository evidence yet"
            description="Import a repository or snapshot and run source analysis before architecture claims can be derived."
          />
        </div>
      ) : !ready ? (
        <p className="px-5 py-6 text-sm text-ink-soft">
          Architecture detection is unavailable while the repository import is {repository.status}.
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
                    setSelectedClaimId(null);
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
                <ClaimInput label="From" value={compareFrom} onChange={setCompareFrom} />
                <ClaimInput label="To" value={compareTo} onChange={setCompareTo} />
                <Button
                  type="submit"
                  disabled={
                    !compareFrom.trim() ||
                    !compareTo.trim() ||
                    compareFrom.trim() === compareTo.trim() ||
                    isComparing
                  }
                >
                  {isComparing ? 'Comparing…' : 'Compare analyses'}
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
              <Skeleton className="h-64 w-full" />
            </div>
          ) : architecture ? (
            <>
              <div className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-[0.7rem] text-ink-soft">
                    {shortHash(architecture.commitHash)} · {architecture.analyzerVersion} ·{' '}
                    {architecture.sourceType}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="active">{architecture.metrics.detectedCount} detected</Badge>
                    <Badge>{architecture.metrics.likelyCount} likely</Badge>
                    <Badge tone="warning">{architecture.metrics.possibleCount} possible</Badge>
                    <Badge>{architecture.metrics.unknownCount} unknown</Badge>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  <Metric label="Modules" value={architecture.metrics.moduleCount} />
                  <Metric label="Internal edges" value={architecture.metrics.internalEdgeCount} />
                  <Metric label="Cross-module" value={architecture.metrics.crossModuleEdgeCount} />
                  <Metric label="Frameworks" value={architecture.metrics.frameworkCount} />
                  <Metric label="Entry candidates" value={architecture.metrics.entryPointCount} />
                  <Metric label="Deploy paths" value={architecture.metrics.deploymentConfigCount} />
                </div>

                {architecture.limits.length > 0 ? (
                  <ul className="mt-3 space-y-1 text-xs text-clay-dark">
                    {architecture.limits.map((limit) => (
                      <li key={limit}>• {limit}</li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <div className="grid gap-4 border-t border-line p-5 lg:grid-cols-2">
                <div>
                  <h3 className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-ink-faint">
                    Observed import direction
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-ink-soft">
                    {architecture.directionality.crossModuleEdgeCount === 0
                      ? 'No cross-module import edge was observed in this analysis.'
                      : architecture.directionality.hasModuleCycle
                        ? 'Cross-module imports form a cycle, so no layer order is claimed.'
                        : `${architecture.directionality.sourceModuleIds.length} source module(s) and ${architecture.directionality.sinkModuleIds.length} sink module(s) were observed.`}
                  </p>
                  <p className="mt-1 text-xs text-ink-faint">
                    Confidence: {architecture.directionality.confidence}
                  </p>
                </div>
                <div>
                  <h3 className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-ink-faint">
                    Module references
                  </h3>
                  <div className="mt-2 max-h-32 space-y-1 overflow-y-auto font-mono text-[0.7rem] text-ink-soft">
                    {architecture.directionality.sourceModuleIds.length > 0 ? (
                      <p>
                        Sources:{' '}
                        {architecture.directionality.sourceModuleIds
                          .map((id) => moduleName(architecture.modules, id))
                          .join(', ')}
                      </p>
                    ) : null}
                    {architecture.directionality.sinkModuleIds.length > 0 ? (
                      <p>
                        Sinks:{' '}
                        {architecture.directionality.sinkModuleIds
                          .map((id) => moduleName(architecture.modules, id))
                          .join(', ')}
                      </p>
                    ) : null}
                    {architecture.directionality.sourceModuleIds.length === 0 &&
                    architecture.directionality.sinkModuleIds.length === 0 ? (
                      <p>No directional evidence recorded.</p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="border-t border-line px-5 py-4">
                <h3 className="font-display text-lg">Boundary candidates</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {visibleModules.map((module) => (
                    <ModuleCard
                      key={module.id}
                      module={module}
                      modules={architecture.modules}
                    />
                  ))}
                </div>
                {architecture.modules.length > visibleModules.length ? (
                  <p className="mt-2 font-mono text-[0.65rem] text-ink-faint">
                    Displaying {visibleModules.length} of {architecture.modules.length} modules.
                  </p>
                ) : null}
              </div>

              <div className="border-t border-line px-5 py-4">
                <h3 className="font-display text-lg">
                  Evidence claims ({architecture.claims.length})
                </h3>
                <div className="mt-3 space-y-3">
                  {visibleClaims.map((claim) => (
                    <ClaimCard
                      key={claim.id}
                      claim={claim}
                      expanded={selectedClaimId === claim.id}
                      onToggle={() =>
                        setSelectedClaimId((current) => (current === claim.id ? null : claim.id))
                      }
                    />
                  ))}
                </div>
                {architecture.claims.length > visibleClaims.length ? (
                  <p className="mt-2 font-mono text-[0.65rem] text-ink-faint">
                    Displaying {visibleClaims.length} of {architecture.claims.length} claims.
                  </p>
                ) : null}
                {selectedClaim ? (
                  <div className="mt-4 border border-line-strong bg-paper-sunken/40 p-3">
                    <p className="font-mono text-[0.65rem] uppercase tracking-[0.12em] text-ink-faint">
                      Full evidence for {selectedClaim.title}
                    </p>
                    <EvidenceList evidence={selectedClaim.evidence} />
                  </div>
                ) : null}
              </div>

              {compareError ? (
                <div className="border-t border-line px-5 py-4">
                  <Alert>Both commits need stored source analysis before they can be compared.</Alert>
                </div>
              ) : comparison ? (
                <div className="border-t border-line px-5 py-4">
                  <h3 className="font-display text-lg">
                    Change {shortHash(comparison.fromCommitHash)} →{' '}
                    {shortHash(comparison.toCommitHash)}
                  </h3>
                  <div className="mt-2 grid gap-2 sm:grid-cols-4">
                    <Metric label="Added modules" value={comparison.addedModules.length} />
                    <Metric label="Removed modules" value={comparison.removedModules.length} />
                    <Metric label="Added claims" value={comparison.addedClaims.length} />
                    <Metric label="Removed claims" value={comparison.removedClaims.length} />
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <EvolutionList
                      title="Added modules"
                      items={comparison.addedModules.map((module) => module.name)}
                    />
                    <EvolutionList
                      title="Removed modules"
                      items={comparison.removedModules.map((module) => module.name)}
                    />
                    <EvolutionList
                      title="Added claims"
                      items={comparison.addedClaims.map((claim) => claim.title)}
                    />
                    <EvolutionList
                      title="Removed claims"
                      items={comparison.removedClaims.map((claim) => claim.title)}
                    />
                  </div>
                  {comparison.confidenceChanges.length > 0 ? (
                    <ul className="mt-3 max-h-32 space-y-1 overflow-y-auto font-mono text-[0.7rem]">
                      {comparison.confidenceChanges.slice(0, MAX_LIST_ITEMS).map((change) => (
                        <li key={change.id} className="break-all">
                          {change.id}: {change.before} → {change.after}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-xs text-ink-soft">No claim confidence changed.</p>
                  )}
                  <p className="mt-3 text-xs leading-relaxed text-ink-soft">{comparison.basis}</p>
                </div>
              ) : null}

              <div className="border-t border-line px-5 py-4">
                <p className="text-xs leading-relaxed text-ink-soft">{architecture.basis}</p>
              </div>
            </>
          ) : (
            <p className="px-5 py-6 text-sm text-ink-soft">
              Run source analysis to record the paths, symbols and imports these claims require.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function ClaimInput({
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

function confidenceTone(confidence: ArchitectureConfidence): 'neutral' | 'active' | 'warning' {
  if (confidence === 'detected' || confidence === 'likely') return 'active';
  if (confidence === 'possible') return 'warning';
  return 'neutral';
}

function moduleName(modules: ArchitectureModule[], id: string): string {
  return modules.find((module) => module.id === id)?.name ?? id;
}

function ModuleCard({
  module,
  modules,
}: {
  module: ArchitectureModule;
  modules: ArchitectureModule[];
}) {
  return (
    <div className="border border-line bg-paper-sunken/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="break-all font-mono text-xs text-ink">{module.name}</p>
        <Badge tone={confidenceTone(module.confidence)}>{module.confidence}</Badge>
      </div>
      <p className="mt-1 text-xs text-ink-soft">
        {module.kind} · {module.fileCount} file(s) · {module.symbolCount} symbol(s)
      </p>
      <p className="mt-1 font-mono text-[0.65rem] text-ink-faint">
        internal {module.internalEdgeCount} · external {module.externalEdgeCount}
      </p>
      {module.imports.length > 0 ? (
        <p className="mt-1 break-all font-mono text-[0.65rem] text-ink-soft">
          imports {module.imports.slice(0, 4).map((id) => moduleName(modules, id)).join(', ')}
        </p>
      ) : null}
      {module.importedBy.length > 0 ? (
        <p className="mt-1 break-all font-mono text-[0.65rem] text-ink-soft">
          imported by{' '}
          {module.importedBy.slice(0, 4).map((id) => moduleName(modules, id)).join(', ')}
        </p>
      ) : null}
    </div>
  );
}

function ClaimCard({
  claim,
  expanded,
  onToggle,
}: {
  claim: ArchitectureClaim;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border border-line bg-paper-sunken/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onToggle}
          className="text-left font-display text-base text-ink hover:text-clay"
        >
          {claim.title}
        </button>
        <div className="flex flex-wrap gap-2">
          <Badge tone={confidenceTone(claim.confidence)}>{claim.confidence}</Badge>
          <Badge>{claim.type.replaceAll('_', ' ')}</Badge>
        </div>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-ink-soft">{claim.statement}</p>
      <p className="mt-1 font-mono text-[0.65rem] text-ink-faint">Rule: {claim.rule}</p>
      {expanded ? <EvidenceList evidence={claim.evidence} /> : null}
    </div>
  );
}

function EvidenceList({ evidence }: { evidence: ArchitectureEvidence[] }) {
  if (evidence.length === 0) {
    return <p className="mt-2 text-xs text-ink-faint">No stored evidence for this claim.</p>;
  }
  return (
    <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto font-mono text-[0.65rem]">
      {evidence.map((item, index) => (
        <li key={`${item.kind}:${item.path}:${item.line}:${index}`} className="break-all">
          {item.kind} · {item.path}
          {item.line === null ? '' : `:${item.line}`} · {item.detail}
        </li>
      ))}
    </ul>
  );
}

function EvolutionList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.12em] text-ink-faint">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="mt-1 text-xs text-ink-soft">None observed.</p>
      ) : (
        <ul className="mt-1 max-h-28 space-y-1 overflow-y-auto font-mono text-[0.65rem]">
          {items.slice(0, MAX_LIST_ITEMS).map((item, index) => (
            <li key={`${item}:${index}`} className="break-all">
              {item}
            </li>
          ))}
          {items.length > MAX_LIST_ITEMS ? (
            <li className="text-ink-faint">+{items.length - MAX_LIST_ITEMS} more</li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
