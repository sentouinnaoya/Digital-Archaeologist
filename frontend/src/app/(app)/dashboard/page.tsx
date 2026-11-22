'use client';

import Link from 'next/link';
import { ArrowUpRight, FolderOpen } from 'lucide-react';
import { useMeQuery } from '@/store/api/authApi';
import { useGetProjectsQuery } from '@/store/api/projectsApi';
import { Badge, Alert, EmptyState, Skeleton } from '@/components/ui/States';
import { getErrorMessage } from '@/lib/types';

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="border border-line bg-paper-raised px-5 py-5">
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-ink-faint">
        {label}
      </p>
      <p className="mt-3 font-display text-4xl text-ink">{value}</p>
      <p className="mt-2 text-xs text-ink-soft">{note}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { data: projects, isLoading, error } = useGetProjectsQuery({ page: 1, limit: 100 });
  const { data: user } = useMeQuery();

  const total = projects?.meta.total ?? 0;
  const analysed =
    projects?.data.filter((project) => project.analysisStatus !== 'not_started').length ?? 0;
  const lastAnalyzed = projects?.data
    .filter((project) => project.lastAnalyzedAt)
    .map((project) => project.lastAnalyzedAt as string)
    .sort()
    .at(-1);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="border-b border-line pb-7">
        <p className="eyebrow">Workspace overview</p>
        <h1 className="mt-3 font-display text-4xl tracking-tight">
          {user ? `Welcome back, ${user.fullName.split(' ')[0]}` : 'Field dashboard'}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
          Counts below are calculated from your stored project records. No analysis metrics
          are shown until the analysis engine has actually run.
        </p>
      </header>

      {error ? (
        <div className="mt-7">
          <Alert>{getErrorMessage(error)}</Alert>
        </div>
      ) : null}

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        {isLoading ? (
          <>
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </>
        ) : (
          <>
            <Stat label="Projects" value={String(total)} note="Project records you own" />
            <Stat
              label="Analysed repositories"
              value={String(analysed)}
              note="Projects with at least one analysis run"
            />
            <Stat
              label="Last analysis"
              value={lastAnalyzed ? lastAnalyzed.slice(0, 10) : '—'}
              note={lastAnalyzed ? 'Most recent recorded run' : 'No analysis recorded yet'}
            />
          </>
        )}
      </section>

      <section className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="flex items-center justify-between border-b border-line pb-3">
            <h2 className="font-display text-2xl">Recent project records</h2>
            <Link
              href="/projects"
              className="inline-flex items-center gap-1 font-mono text-[0.7rem] uppercase tracking-wider text-clay hover:underline"
            >
              All projects <ArrowUpRight size={13} />
            </Link>
          </div>

          <div className="mt-4">
            {isLoading ? (
              <Skeleton className="h-40" />
            ) : projects && projects.data.length > 0 ? (
              <ul className="border border-line bg-paper-raised">
                {projects.data.slice(0, 5).map((project) => (
                  <li key={project.id} className="border-b border-line last:border-b-0">
                    <Link
                      href={`/projects/${project.id}`}
                      className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-paper-sunken/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{project.name}</p>
                        <p className="mt-1 truncate font-mono text-[0.7rem] text-ink-faint">
                          {project.defaultBranch} · created {project.createdAt.slice(0, 10)}
                        </p>
                      </div>
                      <Badge tone={project.analysisStatus === 'completed' ? 'active' : 'neutral'}>
                        {project.analysisStatus.replace('_', ' ')}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No project records yet"
                description="Create a project to establish a workspace before repository import becomes available."
                action={
                  <Link
                    href="/projects"
                    className="inline-flex border border-ink bg-ink px-4 py-2 text-sm text-paper-raised"
                  >
                    Go to projects
                  </Link>
                }
              />
            )}
          </div>
        </div>

        <div>
          <h2 className="border-b border-line pb-3 font-display text-2xl">Instrument status</h2>
          <div className="mt-4 border border-line bg-paper-raised p-5">
            <div className="flex items-start gap-3">
              <FolderOpen size={18} className="mt-0.5 shrink-0 text-clay" strokeWidth={1.6} />
              <div>
                <p className="text-sm font-medium">Repository import · Phase 2</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  Git URL import, commit history and contributor analysis are not implemented
                  in this release. Project records can be created now and will be used by the
                  analysis pipeline later.
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4 border border-line bg-paper-raised p-5">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-ink-faint">
              Data source
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              All values on this page are read from the API. Nothing is simulated or cached
              from example repositories.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
