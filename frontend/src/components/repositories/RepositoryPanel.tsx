'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, GitBranch, RefreshCw, Scale, Tag } from 'lucide-react';
import {
  useGetProjectRepositoryStatusQuery,
  useImportRepositoryMutation,
  useReanalyzeRepositoryMutation,
} from '@/store/api/repositoriesApi';
import { Alert, Badge, Skeleton } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { getErrorMessage } from '@/lib/types';
import { formatDate, shortHash } from '@/lib/format';

export function RepositoryPanel({ projectId }: { projectId: string }) {
  const [form, setForm] = useState({ repositoryUrl: '', defaultBranch: 'main' });
  const [importRepository, { isLoading: importing, error: importError }] =
    useImportRepositoryMutation();
  const [reanalyze, { isLoading: reanalyzing, error: reanalyzeError }] =
    useReanalyzeRepositoryMutation();

  const { data, isLoading, error, refetch } =
    useGetProjectRepositoryStatusQuery(projectId);
  const repository = data?.repository ?? null;
  const job = data?.job ?? null;
  const jobActive = job?.status === 'queued' || job?.status === 'running';

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
            <h2 className="font-display text-xl">Import a public repository</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Only public HTTPS Git URLs are accepted. The importer resolves and validates the
              host, clones into isolated local storage, then records real commits, branches,
              tags, contributors and licence evidence.
            </p>
          </div>
        </div>

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
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
        <div className="min-w-0">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-ink-faint">
            Imported repository
          </p>
          <p className="mt-2 break-all font-mono text-sm text-ink">{repository.repositoryUrl}</p>
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
        <Detail label="HEAD" value={shortHash(repository.headCommitHash)} />
        <Detail label="Commits stored" value={`${repository.analyzedCommitCount} / ${repository.totalCommitCount}`} />
        <Detail label="Last analysed" value={formatDate(repository.lastAnalyzedAt)} />
        <Detail label="Detected languages" value={repository.detectedLanguages.join(', ') || 'None detected'} />
      </div>

      <div className="mt-6 flex flex-wrap gap-4 border-t border-line pt-5 text-xs text-ink-soft">
        <span className="inline-flex items-center gap-1.5">
          <GitBranch size={13} /> {repository.branches.length} branch(es)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Tag size={13} /> {repository.tags.length} tag(s)
        </span>
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
        <Link
          href={`/projects/${projectId}/history`}
          className="inline-flex items-center gap-2 border border-ink bg-ink px-4 py-2 text-sm text-paper-raised hover:border-clay hover:bg-clay"
        >
          Examine history <ArrowRight size={14} />
        </Link>
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
