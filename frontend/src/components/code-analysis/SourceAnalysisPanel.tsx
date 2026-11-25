'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useGetProjectRepositoryStatusQuery } from '@/store/api/repositoriesApi';
import {
  useAnalyzeSourceMutation,
  useGetProjectSourceAnalysisQuery,
} from '@/store/api/codeAnalysisApi';
import { Alert, Badge, EmptyState, Skeleton } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { formatBytes, formatDateTime, shortHash } from '@/lib/format';
import { getErrorMessage } from '@/lib/types';
import type { ParsedSourceFile, SourceFileStatus } from '@/lib/types';

export function SourceAnalysisPanel({ projectId }: { projectId: string }) {
  const { data: status } = useGetProjectRepositoryStatusQuery(projectId);
  const repository = status?.repository ?? null;
  const [commitInput, setCommitInput] = useState('');

  useEffect(() => {
    setCommitInput(repository?.headCommitHash ?? '');
  }, [repository?.headCommitHash]);

  const {
    data: analysis,
    isLoading,
    error,
    refetch,
  } = useGetProjectSourceAnalysisQuery(projectId, {
    skip: !repository?.id || repository.status !== 'ready',
  });
  const [analyze, { isLoading: isAnalyzing, error: analyzeError }] =
    useAnalyzeSourceMutation();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!repository?.id) return;
    try {
      await analyze({
        repositoryId: repository.id,
        commitHash: repository.sourceType === 'git_url' ? commitInput.trim() || undefined : undefined,
      }).unwrap();
      await refetch();
    } catch {
      // RTK Query exposes the error through analyzeError.
    }
  };

  const canAnalyze =
    repository?.status === 'ready' &&
    (repository.sourceType === 'zip' || commitInput.trim().length > 0);

  return (
    <section className="border border-line bg-paper-raised">
      <div className="border-b border-line px-5 py-4">
        <h2 className="font-display text-2xl">Source analysis</h2>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-soft">
          Native Tree-sitter parses stored source text. Symbols, imports and syntax diagnostics are
          recorded with their file paths and line numbers. Unsupported languages are labelled, not
          guessed.
        </p>
      </div>

      {!repository ? (
        <div className="p-5">
          <EmptyState
            title="No repository evidence yet"
            description="Import a Git repository or ZIP snapshot before running source analysis."
          />
        </div>
      ) : repository.status !== 'ready' ? (
        <p className="px-5 py-6 text-sm text-ink-soft">
          Source analysis is unavailable while the repository import is {repository.status}.
        </p>
      ) : (
        <>
          <form
            onSubmit={(event) => void submit(event)}
            className="flex flex-wrap items-end gap-2 border-b border-line bg-paper-sunken/40 px-5 py-4"
          >
            {repository.sourceType === 'git_url' ? (
              <label className="min-w-[16rem] flex-1">
                <span className="mb-1 block font-mono text-[0.65rem] uppercase tracking-[0.12em] text-ink-faint">
                  Commit hash
                </span>
                <input
                  value={commitInput}
                  onChange={(event) => setCommitInput(event.target.value)}
                  placeholder="Full or analysed commit hash"
                  className="w-full border border-line-strong bg-paper-raised px-2 py-2 font-mono text-xs text-ink"
                />
              </label>
            ) : (
              <p className="flex-1 text-sm text-ink-soft">
                ZIP snapshot <span className="font-mono">{repository.snapshotName}</span> will be
                parsed from its stored files. No commit is invented.
              </p>
            )}
            <Button type="submit" disabled={!canAnalyze || isAnalyzing}>
              {isAnalyzing ? 'Parsing…' : analysis ? 'Refresh analysis' : 'Run analysis'}
            </Button>
          </form>

          {analyzeError ? (
            <div className="p-5">
              <Alert>{getErrorMessage(analyzeError)}</Alert>
            </div>
          ) : null}

          {isLoading ? (
            <div className="p-5">
              <Skeleton className="h-48 w-full" />
            </div>
          ) : analysis ? (
            <div className="px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-[0.7rem] text-ink-soft">
                  {shortHash(analysis.commitHash)} · {analysis.analyzerVersion} ·{' '}
                  {formatDateTime(analysis.createdAt)}
                </p>
                <div className="flex gap-2">
                  {analysis.cached ? <Badge>cached</Badge> : null}
                  <Badge tone="active">{analysis.summary.parsedCount} parsed</Badge>
                  {analysis.summary.syntaxErrorCount > 0 ? (
                    <Badge tone="warning">
                      {analysis.summary.syntaxErrorCount} syntax errors
                    </Badge>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <Metric label="Files" value={analysis.summary.fileCount} />
                <Metric label="Parsed" value={analysis.summary.parsedCount} />
                <Metric label="Syntax errors" value={analysis.summary.syntaxErrorCount} />
                <Metric label="Unsupported" value={analysis.summary.unsupportedCount} />
                <Metric label="Symbols" value={analysis.summary.symbolCount} />
                <Metric label="Imports" value={analysis.summary.importCount} />
              </div>

              {analysis.summary.fileLimitApplied ? (
                <p className="mt-3 font-mono text-[0.65rem] text-ink-faint">
                  Analysis limit reached: only the configured number of files was parsed.
                </p>
              ) : null}

              <ul className="mt-4 max-h-96 space-y-2 overflow-y-auto">
                {analysis.files.map((file) => (
                  <SourceFileRow key={file.path} file={file} />
                ))}
              </ul>
            </div>
          ) : error ? (
            <div className="p-5">
              <Alert tone="info">No stored source analysis is available for this project yet.</Alert>
            </div>
          ) : (
            <p className="px-5 py-6 text-sm text-ink-soft">
              Run an analysis to record observed source structure.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-line bg-paper-sunken/40 px-3 py-2">
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink-faint">
        {label}
      </p>
      <p className="mt-1 font-display text-xl text-ink">{value}</p>
    </div>
  );
}

function SourceFileRow({ file }: { file: ParsedSourceFile }) {
  return (
    <li className="border border-line bg-paper-sunken/30">
      <details>
        <summary className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
          <span className="break-all font-mono text-ink">{file.path}</span>
          <span className="flex items-center gap-2">
            <span className="font-mono text-ink-faint">{formatBytes(file.size)}</span>
            <StatusBadge status={file.status} />
          </span>
        </summary>
        <div className="border-t border-line px-3 py-3 text-xs text-ink-soft">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.12em] text-ink-faint">
            {file.language ?? 'Unknown language'} · {file.parser}
          </p>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            <div>
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.12em] text-ink-faint">
                Symbols ({file.symbols.length})
              </p>
              <ul className="mt-1 max-h-24 overflow-y-auto font-mono">
                {file.symbols.slice(0, 30).map((symbol, index) => (
                  <li key={`${symbol.kind}-${symbol.name}-${index}`}>
                    {symbol.name} <span className="text-ink-faint">L{symbol.startLine}</span>
                  </li>
                ))}
                {file.symbols.length === 0 ? <li className="text-ink-faint">None observed</li> : null}
              </ul>
            </div>
            <div>
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.12em] text-ink-faint">
                Imports ({file.imports.length})
              </p>
              <ul className="mt-1 max-h-24 overflow-y-auto font-mono">
                {file.imports.slice(0, 30).map((item, index) => (
                  <li key={`${item.source}-${index}`}>
                    {item.source} <span className="text-ink-faint">L{item.line}</span>
                  </li>
                ))}
                {file.imports.length === 0 ? <li className="text-ink-faint">None observed</li> : null}
              </ul>
            </div>
          </div>
          {file.syntaxErrors.length > 0 ? (
            <div className="mt-3 border-l-2 border-alert/60 pl-3">
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.12em] text-ink-faint">
                Syntax diagnostics
              </p>
              <ul className="mt-1 space-y-1">
                {file.syntaxErrors.slice(0, 10).map((item, index) => (
                  <li key={`${item.line}-${item.column}-${index}`}>
                    L{item.line}:{item.column} {item.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {file.truncated ? (
            <p className="mt-2 font-mono text-[0.65rem] text-ink-faint">
              Output truncated at the configured per-file limit.
            </p>
          ) : null}
        </div>
      </details>
    </li>
  );
}

function StatusBadge({ status }: { status: SourceFileStatus }) {
  const tone = status === 'parsed' ? 'active' : status === 'unsupported' ? 'neutral' : 'warning';
  return <Badge tone={tone}>{status.replaceAll('_', ' ')}</Badge>;
}
