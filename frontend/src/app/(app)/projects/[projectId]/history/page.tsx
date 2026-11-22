'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { GitBranch, Tag, Users } from 'lucide-react';
import { useGetProjectQuery } from '@/store/api/projectsApi';
import {
  useGetProjectBranchesQuery,
  useGetProjectCommitsQuery,
  useGetProjectContributorsQuery,
  useGetProjectRepositoryStatusQuery,
  useGetProjectTagsQuery,
} from '@/store/api/repositoriesApi';
import { Alert, Badge, EmptyState, Skeleton } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { formatDate, shortHash } from '@/lib/format';
import { getErrorMessage } from '@/lib/types';

export default function HistoryPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const [page, setPage] = useState(1);

  const { data: project } = useGetProjectQuery(projectId);
  const { data: status, isLoading: statusLoading, error: statusError } =
    useGetProjectRepositoryStatusQuery(projectId);
  const repository = status?.repository ?? null;

  const {
    data: commits,
    isLoading: commitsLoading,
    error: commitsError,
  } = useGetProjectCommitsQuery(
    { projectId, page, limit: 20 },
    { skip: !repository },
  );
  const { data: branches } = useGetProjectBranchesQuery(projectId, {
    skip: !repository,
  });
  const { data: tags } = useGetProjectTagsQuery(projectId, { skip: !repository });
  const { data: contributors } = useGetProjectContributorsQuery(projectId, {
    skip: !repository,
  });

  return (
    <div className="mx-auto max-w-6xl">
      <Link href={`/projects/${projectId}`} className="eyebrow hover:text-ink">
        ← Project record
      </Link>

      <header className="mt-7 border-b border-line pb-7">
        <p className="eyebrow">Observed Git history</p>
        <h1 className="mt-3 font-display text-4xl tracking-tight">
          {project ? `${project.name} — history` : 'Repository history'}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
          Every entry below is read from an imported Git repository. Messages are shown
          verbatim and changed paths come from the commit itself, not from an estimate.
        </p>
      </header>

      {statusError ? (
        <div className="mt-7">
          <Alert>{getErrorMessage(statusError)}</Alert>
        </div>
      ) : null}

      {statusLoading ? (
        <Skeleton className="mt-8 h-64 w-full" />
      ) : !repository ? (
        <div className="mt-8">
          <EmptyState
            title="No repository imported"
            description="Import a public HTTPS Git repository from the project record before examining history."
            action={
              <Link
                href={`/projects/${projectId}`}
                className="inline-flex border border-ink bg-ink px-4 py-2 text-sm text-paper-raised"
              >
                Go to project
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
          <section>
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 className="font-display text-2xl">Commits</h2>
              {commits ? (
                <span className="font-mono text-[0.7rem] text-ink-faint">
                  {commits.meta.total} RECORDED
                </span>
              ) : null}
            </div>

            {commitsError ? (
              <div className="mt-4">
                <Alert>{getErrorMessage(commitsError)}</Alert>
              </div>
            ) : commitsLoading ? (
              <Skeleton className="mt-4 h-80 w-full" />
            ) : commits && commits.data.length > 0 ? (
              <>
                <ul className="mt-4 border border-line bg-paper-raised">
                  {commits.data.map((commit) => (
                    <li key={commit.id} className="border-b border-line last:border-b-0">
                      <article className="px-5 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="whitespace-pre-wrap break-words text-sm font-medium text-ink">
                            {commit.message || '(empty commit message)'}
                          </p>
                          <span className="font-mono text-xs text-clay">
                            {shortHash(commit.hash)}
                          </span>
                        </div>
                        <p className="mt-2 font-mono text-[0.7rem] text-ink-faint">
                          {commit.authorName} · {formatDate(commit.authoredAt)} ·{' '}
                          {commit.parentHashes.length}{' '}
                          {commit.parentHashes.length === 1 ? 'parent' : 'parents'}
                        </p>
                        {commit.fileChanges.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {commit.fileChanges.map((change, index) => (
                              <span
                                key={`${change.path}-${index}`}
                                className="border border-line bg-paper-sunken/60 px-2 py-0.5 font-mono text-[0.65rem] text-ink-soft"
                                title={`${change.status} — ${change.path}`}
                              >
                                {change.status} {change.path}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </article>
                    </li>
                  ))}
                </ul>
                {commits.meta.totalPages > 1 ? (
                  <div className="mt-4 flex items-center justify-between">
                    <Button
                      variant="secondary"
                      disabled={page <= 1}
                      onClick={() => setPage((value) => value - 1)}
                    >
                      Previous
                    </Button>
                    <span className="font-mono text-xs text-ink-soft">
                      PAGE {page} / {commits.meta.totalPages}
                    </span>
                    <Button
                      variant="secondary"
                      disabled={page >= commits.meta.totalPages}
                      onClick={() => setPage((value) => value + 1)}
                    >
                      Next
                    </Button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="mt-4">
                <EmptyState
                  title="No commits recorded"
                  description="The repository was imported but no commit history was available on the analysed branch."
                />
              </div>
            )}
          </section>

          <aside className="space-y-8">
            <div>
              <h2 className="border-b border-line pb-3 font-display text-2xl">Refs</h2>
              <div className="mt-4 border border-line bg-paper-raised p-5">
                <p className="flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-ink-faint">
                  <GitBranch size={13} /> Branches
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {branches?.length ? (
                    branches.map((branch) => <Badge key={branch}>{branch}</Badge>)
                  ) : (
                    <span className="text-sm text-ink-soft">None recorded</span>
                  )}
                </div>
                <p className="mt-6 flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-ink-faint">
                  <Tag size={13} /> Tags
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {tags?.length ? (
                    tags.map((tag) => <Badge key={tag}>{tag}</Badge>)
                  ) : (
                    <span className="text-sm text-ink-soft">None recorded</span>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h2 className="border-b border-line pb-3 font-display text-2xl">Contributors</h2>
              <div className="mt-4 border border-line bg-paper-raised">
                {contributors?.length ? (
                  <ul>
                    {contributors.map((contributor) => (
                      <li
                        key={contributor.email}
                        className="flex items-start justify-between gap-3 border-b border-line px-5 py-4 last:border-b-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm text-ink">{contributor.name}</p>
                          <p className="truncate font-mono text-[0.7rem] text-ink-faint">
                            {contributor.email}
                          </p>
                        </div>
                        <span className="shrink-0 font-mono text-xs text-clay">
                          {contributor.commitCount}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-5 py-6 text-sm text-ink-soft">No contributors recorded.</p>
                )}
              </div>
              <p className="mt-3 flex items-center gap-1.5 font-mono text-[0.65rem] text-ink-faint">
                <Users size={12} /> Counts are derived from stored commits.
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
