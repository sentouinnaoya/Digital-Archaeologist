'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  useCompareProjectHistoryFileQuery,
  useCompareProjectHistoryQuery,
} from '@/store/api/comparisonApi';
import { useGetProjectSourceAnalysisQuery } from '@/store/api/codeAnalysisApi';
import {
  useGetProjectCommitsQuery,
  useGetProjectRepositoryStatusQuery,
} from '@/store/api/repositoriesApi';
import { Alert, Badge, EmptyState, Skeleton } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { shortHash } from '@/lib/format';
import type {
  CommitComparison,
  SourceFileDiff,
  SourceDiffRow,
  SymbolChange,
} from '@/lib/types';

const MAX_LIST_ITEMS = 12;

export function HistoricalComparisonPanel({ projectId }: { projectId: string }) {
  const { data: status } = useGetProjectRepositoryStatusQuery(projectId);
  const repository = status?.repository ?? null;
  const ready = repository?.status === 'ready';
  const isGit = repository?.sourceType === 'git_url';

  const { data: commits } = useGetProjectCommitsQuery(
    { projectId, page: 1, limit: 50 },
    { skip: !ready || !isGit },
  );
  const { data: analysis } = useGetProjectSourceAnalysisQuery(projectId, { skip: !ready });

  const [compareFrom, setCompareFrom] = useState('');
  const [compareTo, setCompareTo] = useState('');
  const [comparisonRange, setComparisonRange] = useState<{ from: string; to: string } | null>(null);
  const [selectedPath, setSelectedPath] = useState('');

  const commitOptions = useMemo(() => {
    const hashes = (commits?.data ?? []).map((commit) => commit.hash);
    for (const hash of [repository?.headCommitHash, analysis?.commitHash]) {
      if (hash && /^[0-9a-f]{4,40}$/i.test(hash) && !hashes.includes(hash)) {
        hashes.unshift(hash);
      }
    }
    return [...new Set(hashes)].slice(0, 50);
  }, [analysis?.commitHash, commits?.data, repository?.headCommitHash]);

  useEffect(() => {
    if (!ready || !isGit) return;
    setCompareFrom((current) => current || commitOptions[1] || '');
    setCompareTo((current) => current || commitOptions[0] || '');
  }, [commitOptions, isGit, ready]);

  const comparisonReady = Boolean(
    ready && isGit && comparisonRange && comparisonRange.from !== comparisonRange.to,
  );
  const {
    data: comparison,
    isFetching: isComparing,
    error: comparisonError,
  } = useCompareProjectHistoryQuery(
    {
      projectId,
      from: comparisonRange?.from ?? '',
      to: comparisonRange?.to ?? '',
    },
    { skip: !comparisonReady },
  );

  const availablePaths = useMemo(() => buildPathOptions(comparison), [comparison]);

  useEffect(() => {
    if (availablePaths.length === 0) {
      setSelectedPath('');
      return;
    }
    setSelectedPath((current) =>
      availablePaths.includes(current) ? current : availablePaths[0],
    );
  }, [availablePaths]);

  const {
    data: fileDiff,
    isFetching: isReadingFile,
    error: fileDiffError,
  } = useCompareProjectHistoryFileQuery(
    {
      projectId,
      from: comparisonRange?.from ?? '',
      to: comparisonRange?.to ?? '',
      path: selectedPath,
    },
    { skip: !comparisonReady || !selectedPath },
  );

  const applyComparison = (event: FormEvent) => {
    event.preventDefault();
    const from = compareFrom.trim();
    const to = compareTo.trim();
    if (!from || !to || from === to) return;
    setSelectedPath('');
    setComparisonRange({ from, to });
  };

  return (
    <section className="border border-line bg-paper-raised">
      <div className="border-b border-line px-5 py-4">
        <h2 className="font-display text-2xl">Historical comparison</h2>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-ink-soft">
          Select two analysed commits to compare observed Git file changes, replayed paths, stored
          symbols and dependency graphs. Side-by-side source text is read from the local clone on
          request; it is never stored in MongoDB or executed. A missing symbol or edge means absent
          from that stored analysis, not that it never existed.
        </p>
      </div>

      {!repository ? (
        <div className="p-5">
          <EmptyState
            title="No history to compare"
            description="Import a Git repository before selecting two commits for comparison."
          />
        </div>
      ) : !ready ? (
        <p className="px-5 py-6 text-sm text-ink-soft">
          Historical comparison is unavailable while the repository import is {repository.status}.
        </p>
      ) : !isGit ? (
        <div className="p-5">
          <EmptyState
            title="Unavailable for ZIP snapshots"
            description="A ZIP import is a single file inventory with no commits, so historical comparison is deliberately unavailable."
          />
        </div>
      ) : (
        <>
          <form
            onSubmit={(event) => void applyComparison(event)}
            className="flex flex-wrap items-end gap-3 border-b border-line bg-paper-sunken/40 px-5 py-4"
          >
            <CommitInput label="From commit" value={compareFrom} onChange={setCompareFrom} />
            <CommitInput label="To commit" value={compareTo} onChange={setCompareTo} />
            <Button
              type="submit"
              disabled={
                !compareFrom.trim() ||
                !compareTo.trim() ||
                compareFrom.trim() === compareTo.trim() ||
                isComparing
              }
            >
              {isComparing ? 'Comparing…' : 'Compare commits'}
            </Button>
          </form>

          {comparisonError ? (
            <div className="p-5">
              <Alert>
                Both commits must exist in the analysed history. Run source analysis on each commit
                to enable symbol and dependency diffs.
              </Alert>
            </div>
          ) : isComparing ? (
            <div className="p-5">
              <Skeleton className="h-64 w-full" />
            </div>
          ) : comparison ? (
            <ComparisonResult
              comparison={comparison}
              availablePaths={availablePaths}
              selectedPath={selectedPath}
              onSelectPath={setSelectedPath}
              fileDiff={fileDiff ?? null}
              fileDiffError={Boolean(fileDiffError)}
              isReadingFile={isReadingFile}
            />
          ) : (
            <p className="px-5 py-6 text-sm text-ink-soft">
              Choose two commits to assemble an evidence-based comparison.
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
    <label className="min-w-[12rem] flex-1">
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

function ComparisonResult({
  comparison,
  availablePaths,
  selectedPath,
  onSelectPath,
  fileDiff,
  fileDiffError,
  isReadingFile,
}: {
  comparison: CommitComparison;
  availablePaths: string[];
  selectedPath: string;
  onSelectPath: (path: string) => void;
  fileDiff: SourceFileDiff | null;
  fileDiffError: boolean;
  isReadingFile: boolean;
}) {
  return (
    <>
      <div className="px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-lg">
            {shortHash(comparison.fromCommitHash)} → {shortHash(comparison.toCommitHash)}
          </h3>
          <div className="flex flex-wrap gap-2">
            <Badge tone="active">{comparison.fileChanges.length} file changes</Badge>
            <Badge>{comparison.structure.retainedPathCount} retained paths</Badge>
            {comparison.symbols ? (
              <Badge>
                {comparison.symbols.added.length + comparison.symbols.removed.length} symbol changes
              </Badge>
            ) : (
              <Badge tone="warning">symbols unavailable</Badge>
            )}
            {comparison.dependencies ? (
              <Badge>dependency diff available</Badge>
            ) : (
              <Badge tone="warning">dependencies unavailable</Badge>
            )}
          </div>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-ink-soft">{comparison.from.message}</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-soft">
          <span className="font-mono">{shortHash(comparison.fromCommitHash)}</span> ·{' '}
          {comparison.from.authorName} → <span className="font-mono">{shortHash(comparison.toCommitHash)}</span> ·{' '}
          {comparison.to.message}
        </p>
        {comparison.limits.map((limit) => (
          <p key={limit} className="mt-2 text-xs text-clay-dark">
            • {limit}
          </p>
        ))}
      </div>

      <div className="grid gap-4 border-t border-line p-5 lg:grid-cols-2">
        <PathList
          title="Observed Git file changes"
          items={comparison.fileChanges.map((change) => `${change.status}  ${change.path}`)}
        />
        <PathList title="Paths added to replayed structure" items={comparison.structure.addedPaths} />
        <PathList title="Paths removed from replayed structure" items={comparison.structure.removedPaths} />
        <div>
          <h3 className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-ink-faint">
            Dependency graph changes
          </h3>
          {comparison.dependencies ? (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <Metric label="Added nodes" value={comparison.dependencies.addedNodes.length} />
              <Metric label="Removed nodes" value={comparison.dependencies.removedNodes.length} />
              <Metric label="Added edges" value={comparison.dependencies.addedEdges.length} />
              <Metric label="Removed edges" value={comparison.dependencies.removedEdges.length} />
            </div>
          ) : (
            <p className="mt-2 text-xs text-ink-soft">
              Unavailable: both commits need stored source analysis.
            </p>
          )}
        </div>
      </div>

      <div className="border-t border-line px-5 py-4">
        <h3 className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-ink-faint">
          Stored symbol changes
        </h3>
        {comparison.symbols ? (
          <div className="mt-2 grid gap-4 md:grid-cols-2">
            <SymbolList title="Added" items={comparison.symbols.added} />
            <SymbolList title="Removed" items={comparison.symbols.removed} />
          </div>
        ) : (
          <p className="mt-2 text-xs text-ink-soft">
            Unavailable: both commits need stored source analysis.
          </p>
        )}
      </div>

      <div className="border-t border-line px-5 py-4">
        <h3 className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-ink-faint">
          Side-by-side source diff
        </h3>
        {availablePaths.length === 0 ? (
          <p className="mt-2 text-xs text-ink-soft">
            No changed path was observed between these commits.
          </p>
        ) : (
          <>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <label className="min-w-[18rem] flex-1">
                <span className="mb-1 block font-mono text-[0.65rem] uppercase tracking-[0.12em] text-ink-faint">
                  Changed path
                </span>
                <select
                  value={selectedPath}
                  onChange={(event) => onSelectPath(event.target.value)}
                  className="w-full border border-line-strong bg-paper-raised px-2 py-2 font-mono text-xs text-ink"
                >
                  {availablePaths.map((path) => (
                    <option key={path} value={path}>
                      {path}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {fileDiffError ? (
              <div className="mt-3">
                <Alert tone="info">
                  This path could not be read at the selected commits; no source text is shown.
                </Alert>
              </div>
            ) : isReadingFile ? (
              <div className="mt-3">
                <Skeleton className="h-48 w-full" />
              </div>
            ) : fileDiff ? (
              <SourceDiffView diff={fileDiff} />
            ) : (
              <p className="mt-3 text-xs text-ink-soft">Select a changed path to read its diff.</p>
            )}
          </>
        )}
      </div>

      <div className="border-t border-line px-5 py-4">
        <p className="text-xs leading-relaxed text-ink-soft">{comparison.basis}</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-soft">
          {comparison.structure.basis}
        </p>
      </div>
    </>
  );
}

function buildPathOptions(comparison: CommitComparison | undefined): string[] {
  if (!comparison) return [];
  const paths = new Set<string>();
  for (const change of comparison.fileChanges) paths.add(change.path);
  for (const path of comparison.structure.addedPaths) paths.add(path);
  for (const path of comparison.structure.removedPaths) paths.add(path);
  for (const symbol of comparison.symbols?.added ?? []) paths.add(symbol.path);
  for (const symbol of comparison.symbols?.removed ?? []) paths.add(symbol.path);
  return [...paths].sort();
}

function PathList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-ink-faint">
        {title} ({items.length})
      </h3>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-ink-soft">None observed.</p>
      ) : (
        <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto font-mono text-[0.7rem] text-ink-soft">
          {items.slice(0, MAX_LIST_ITEMS).map((item) => (
            <li key={item} className="break-all">
              {item}
            </li>
          ))}
        </ul>
      )}
      {items.length > MAX_LIST_ITEMS ? (
        <p className="mt-1 font-mono text-[0.65rem] text-ink-faint">
          Displaying {MAX_LIST_ITEMS} of {items.length}.
        </p>
      ) : null}
    </div>
  );
}

function SymbolList({ title, items }: { title: string; items: SymbolChange[] }) {
  return (
    <div>
      <h4 className="font-mono text-[0.65rem] uppercase tracking-[0.12em] text-ink-faint">
        {title} ({items.length})
      </h4>
      {items.length === 0 ? (
        <p className="mt-1 text-xs text-ink-soft">None.</p>
      ) : (
        <ul className="mt-1 max-h-32 space-y-1 overflow-y-auto font-mono text-[0.7rem]">
          {items.slice(0, MAX_LIST_ITEMS).map((item) => (
            <li key={`${item.path}-${item.kind}-${item.name}`} className="break-all">
              {item.path} · {item.kind} {item.name} · line {item.line}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SourceDiffView({ diff }: { diff: SourceFileDiff }) {
  return (
    <div className="mt-3 border border-line">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-paper-sunken/40 px-3 py-2">
        <p className="break-all font-mono text-[0.7rem] text-ink">{diff.path}</p>
        <div className="flex flex-wrap gap-2">
          <Badge tone={diff.fromExists ? 'active' : 'warning'}>
            {diff.fromExists ? shortHash(diff.fromCommitHash) : 'absent'}
          </Badge>
          <Badge tone={diff.toExists ? 'active' : 'warning'}>
            {diff.toExists ? shortHash(diff.toCommitHash) : 'absent'}
          </Badge>
        </div>
      </div>
      {diff.limits.map((limit) => (
        <p key={limit} className="border-b border-line px-3 py-1 text-xs text-clay-dark">
          • {limit}
        </p>
      ))}
      <div className="max-h-[28rem] overflow-auto">
        <table className="w-full border-collapse font-mono text-[0.7rem]">
          <thead className="sticky top-0 bg-paper-raised text-left text-ink-faint">
            <tr>
              <th className="w-12 border-b border-line px-2 py-1 font-normal">—</th>
              <th className="border-b border-line px-2 py-1 font-normal">
                {shortHash(diff.fromCommitHash)}
              </th>
              <th className="w-12 border-b border-line px-2 py-1 font-normal">—</th>
              <th className="border-b border-line px-2 py-1 font-normal">
                {shortHash(diff.toCommitHash)}
              </th>
            </tr>
          </thead>
          <tbody>
            {diff.rows.map((row, index) => (
              <DiffRow key={`${row.leftLine ?? '-'}-${row.rightLine ?? '-'}-${index}`} row={row} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line px-3 py-2 text-xs leading-relaxed text-ink-soft">
        {diff.basis}
      </p>
    </div>
  );
}

function DiffRow({ row }: { row: SourceDiffRow }) {
  const tone = diffRowClass(row.kind);
  return (
    <tr className={tone}>
      <td className="px-2 py-0.5 text-right text-ink-faint">{row.leftLine ?? ''}</td>
      <td className="whitespace-pre-wrap break-all px-2 py-0.5 text-ink">{row.left ?? ''}</td>
      <td className="px-2 py-0.5 text-right text-ink-faint">{row.rightLine ?? ''}</td>
      <td className="whitespace-pre-wrap break-all px-2 py-0.5 text-ink">{row.right ?? ''}</td>
    </tr>
  );
}

function diffRowClass(kind: SourceDiffRow['kind']): string {
  if (kind === 'added') return 'bg-moss/10';
  if (kind === 'removed') return 'bg-alert/10';
  if (kind === 'changed') return 'bg-clay/10';
  return '';
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-line bg-paper-sunken/40 px-3 py-2">
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink-faint">{label}</p>
      <p className="mt-1 font-display text-xl text-ink">{value}</p>
    </div>
  );
}
