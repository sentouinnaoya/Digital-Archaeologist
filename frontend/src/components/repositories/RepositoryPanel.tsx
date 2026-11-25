'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, FileArchive, GitBranch, RefreshCw, Scale, Tag } from 'lucide-react';
import {
  useGetProjectFilesQuery,
  useGetProjectRepositoryStatusQuery,
  useImportRepositoryMutation,
  useImportSnapshotMutation,
  useReanalyzeRepositoryMutation,
} from '@/store/api/repositoriesApi';
import { Alert, Badge, Skeleton } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { getErrorMessage } from '@/lib/types';
import { formatBytes, formatDate, shortHash } from '@/lib/format';

export function RepositoryPanel({ projectId }: { projectId: string }) {
  const [form, setForm] = useState({ repositoryUrl: '', defaultBranch: 'main' });
  const [mode, setMode] = useState<'git' | 'snapshot'>('git');
  const [snapshotFile, setSnapshotFile] = useState<File | null>(null);
  const [importRepository, { isLoading: importing, error: importError }] =
    useImportRepositoryMutation();
  const [importSnapshot, { isLoading: importingSnapshot, error: snapshotError }] =
    useImportSnapshotMutation();
  const [reanalyze, { isLoading: reanalyzing, error: reanalyzeError }] =
    useReanalyzeRepositoryMutation();

  const { data, isLoading, error, refetch } =
    useGetProjectRepositoryStatusQuery(projectId);
  const repository = data?.repository ?? null;
  const job = data?.job ?? null;
  const jobActive = job?.status === 'queued' || job?.status === 'running';
  const isSnapshot = repository?.sourceType === 'zip';
  const { data: snapshotFiles = [] } = useGetProjectFilesQuery(projectId, {
    skip: !isSnapshot || jobActive,
  });

  useEffect(() => {
    if (!jobActive) return;
    const timer = window.setInterval(() => void refetch(), 1500);
    return () => window.clearInterval(timer);
  }, [jobActive, refetch]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await importRepository({
        projectId,
        repositoryUrl: form.repositoryUrl.trim(),
        defaultBranch: form.defaultBranch.trim() || 'main',
      }).unwrap();
      setForm({ repositoryUrl: '', defaultBranch: 'main' });
    } catch {
      // Rendered from the mutation error.
    }
  };

  const submitSnapshot = async (event: FormEvent) => {
    event.preventDefault();
    if (!snapshotFile) return;
    try {
      await importSnapshot({ projectId, file: snapshotFile }).unwrap();
      setSnapshotFile(null);
    } catch {
      // Rendered from the mutation error.
    }
  };

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  if (error) {
    return (
      <Card className="p-6">
        <Alert>{getErrorMessage(error)}</Alert>
      </Card>
    );
  }

  if (!repository) {
    return (
      <Card className="p-6">
        <div className="flex items-start gap-3">
          <GitBranch size={18} className="mt-0.5 shrink-0 text-clay" strokeWidth={1.6} />
          <div>
            <h2 className="font-display text-xl">Add source evidence</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Import a public HTTPS Git repository for full history, or upload a ZIP snapshot
              when no Git history is available. Snapshot analysis records only observed files;
              it never invents commits, branches or contributors.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 border-b border-line pb-4">
          <Button
            type="button"
            variant={mode === 'git' ? 'primary' : 'secondary'}
            onClick={() => setMode('git')}
          >
            <GitBranch size={14} /> Git repository
          </Button>
          <Button
            type="button"
            variant={mode === 'snapshot' ? 'primary' : 'secondary'}
            onClick={() => setMode('snapshot')}
          >
            <FileArchive size={14} /> ZIP snapshot
          </Button>
        </div>

        {mode === 'git' ? (
          <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-4">
            {importError ? <Alert>{getErrorMessage(importError)}</Alert> : null}
            <Field
              label="Repository URL"
              type="url"
              required
              placeholder="https://github.com/owner/repository.git"
              value={form.repositoryUrl}
              onChange={(event) => setForm({ ...form, repositoryUrl: event.target.value })}
            />
            <Field
              label="Default branch"
              required
              value={form.defaultBranch}
              hint="Used as the working branch when the repository is cloned."
              onChange={(event) => setForm({ ...form, defaultBranch: event.target.value })}
            />
            <Button type="submit" disabled={importing} className="w-full">
              {importing ? 'Starting import…' : 'Start import'}
            </Button>
          </form>
        ) : (
          <form onSubmit={(event) => void submitSnapshot(event)} className="mt-6 space-y-4">
            {snapshotError ? <Alert>{getErrorMessage(snapshotError)}</Alert> : null}
            <Field
              label="ZIP archive"
              type="file"
              required
              accept=".zip,application/zip,application/x-zip-compressed"
              hint="A snapshot of source files only. No Git metadata is created or inferred."
              onChange={(event) => setSnapshotFile(event.target.files?.[0] ?? null)}
            />
            <Button type="submit" disabled={importingSnapshot || !snapshotFile} className="w-full">
              {importingSnapshot ? 'Starting snapshot analysis…' : 'Analyse snapshot'}
            </Button>
          </form>
        )}
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
        <div className="min-w-0">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-ink-faint">
            {isSnapshot ? 'ZIP snapshot' : 'Imported repository'}
          </p>
          <p className="mt-2 break-all font-mono text-sm text-ink">
            {isSnapshot
              ? (repository.snapshotName ?? 'snapshot.zip')
              : repository.repositoryUrl}
          </p>
        </div>
        <Badge tone={repository.status === 'ready' ? 'active' : 'warning'}>
          {repository.status}
        </Badge>
      </div>

      {repository.status === 'failed' && repository.lastError ? (
        <div className="mt-5">
          <Alert>{repository.lastError}</Alert>
        </div>
      ) : null}

      {job ? (
        <div className="mt-5 border border-line bg-paper-sunken/40 px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink">{job.currentStep}</p>
            <span className="font-mono text-xs text-ink-soft">{job.progress}%</span>
          </div>
          <div className="mt-3 h-1 w-full bg-line">
            <div
              className={`h-1 transition-all ${job.status === 'failed' ? 'bg-alert' : 'bg-clay'}`}
              style={{ width: `${job.progress}%` }}
            />
          </div>
          {job.error ? <p className="mt-3 text-xs text-alert">{job.error}</p> : null}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {isSnapshot ? (
          <>
            <Detail label="Observed files" value={String(repository.snapshotFileCount)} />
            <Detail label="Snapshot size" value={formatBytes(repository.snapshotTotalBytes)} />
          </>
        ) : (
          <>
            <Detail label="HEAD" value={shortHash(repository.headCommitHash)} />
            <Detail
              label="Commits stored"
              value={`${repository.analyzedCommitCount} / ${repository.totalCommitCount}`}
            />
          </>
        )}
        <Detail label="Last analysed" value={formatDate(repository.lastAnalyzedAt)} />
        <Detail
          label="Detected languages"
          value={repository.detectedLanguages.join(', ') || 'None detected'}
        />
      </div>

      {isSnapshot ? (
        <div className="mt-6 border border-line bg-paper-sunken/40 px-4 py-3">
          <p className="text-sm text-ink">Git history is unavailable for ZIP snapshots.</p>
          <p className="mt-1 text-xs text-ink-soft">
            The inventory below contains only files present in the uploaded archive.
          </p>
          {snapshotFiles.length > 0 ? (
            <ul className="mt-3 max-h-40 overflow-y-auto font-mono text-xs text-ink-soft">
              {snapshotFiles.slice(0, 50).map((file) => (
                <li key={file.path} className="truncate py-0.5">
                  {file.path}
                </li>
              ))}
            </ul>
          ) : null}
          {repository.snapshotFileCount > snapshotFiles.length ? (
            <p className="mt-2 font-mono text-[0.65rem] text-ink-faint">
              Showing {snapshotFiles.length} of {repository.snapshotFileCount} files.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-4 border-t border-line pt-5 text-xs text-ink-soft">
        {!isSnapshot ? (
          <>
            <span className="inline-flex items-center gap-1.5">
              <GitBranch size={13} /> {repository.branches.length} branch(es)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Tag size={13} /> {repository.tags.length} tag(s)
            </span>
          </>
        ) : null}
        <span className="inline-flex items-center gap-1.5">
          <Scale size={13} />{' '}
          {repository.license
            ? `${repository.license.identifier} (${repository.license.confidence})`
            : 'Licence unknown'}
        </span>
      </div>

      {reanalyzeError ? (
        <div className="mt-5">
          <Alert>{getErrorMessage(reanalyzeError)}</Alert>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        {!isSnapshot ? (
          <Link
            href={`/projects/${projectId}/history`}
            className="inline-flex items-center gap-2 border border-ink bg-ink px-4 py-2 text-sm text-paper-raised hover:border-clay hover:bg-clay"
          >
            Examine history <ArrowRight size={14} />
          </Link>
        ) : null}
        <Button
          variant="secondary"
          onClick={() => void reanalyze(repository.id)}
          disabled={jobActive || reanalyzing || repository.status !== 'ready'}
        >
          <RefreshCw size={14} className={jobActive ? 'animate-spin' : ''} />
          {jobActive ? 'Analysis running' : 'Re-analyse'}
        </Button>
      </div>
      <p className="mt-4 font-mono text-[0.65rem] leading-relaxed text-ink-faint">
        Licence detection is informational and is not a legal determination. No imported
        scripts or build commands are executed.
      </p>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-line bg-paper-raised px-4 py-3">
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-ink-faint">
        {label}
      </p>
      <p className="mt-1 break-words text-sm text-ink">{value}</p>
    </div>
  );
}
