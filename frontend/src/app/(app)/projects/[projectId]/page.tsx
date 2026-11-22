'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useGetProjectQuery } from '@/store/api/projectsApi';
import { Alert, Badge, Skeleton } from '@/components/ui/States';
import { Card } from '@/components/ui/Card';
import { RepositoryPanel } from '@/components/repositories/RepositoryPanel';
import { getErrorMessage } from '@/lib/types';

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-line py-3">
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-ink-faint">
        {label}
      </p>
      <p className="mt-1 break-words text-sm text-ink">{value}</p>
    </div>
  );
}

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const { data: project, isLoading, error } = useGetProjectQuery(projectId);

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/projects" className="eyebrow hover:text-ink">
        ← Project registry
      </Link>

      {error ? (
        <div className="mt-8">
          <Alert>{getErrorMessage(error)}</Alert>
        </div>
      ) : null}

      {isLoading ? (
        <div className="mt-8 space-y-4">
          <Skeleton className="h-12 w-2/3" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : project ? (
        <>
          <header className="mt-7 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-7">
            <div>
              <p className="eyebrow">Project record</p>
              <h1 className="mt-3 font-display text-4xl tracking-tight">{project.name}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
                {project.description || 'No description recorded for this project.'}
              </p>
            </div>
            <Badge tone={project.analysisStatus === 'completed' ? 'active' : 'neutral'}>
              {project.analysisStatus.replace('_', ' ')}
            </Badge>
          </header>

          <Card className="mt-8 p-6">
            <h2 className="font-display text-xl">Record metadata</h2>
            <div className="mt-4 grid gap-x-8 sm:grid-cols-2">
              <Detail label="Project ID" value={project.id} />
              <Detail label="Default branch" value={project.defaultBranch} />
              <Detail label="Repository URL" value={project.repositoryUrl ?? 'Not supplied'} />
              <Detail label="Primary language" value={project.primaryLanguage ?? 'Not detected'} />
              <Detail label="Last analysed" value={project.lastAnalyzedAt?.slice(0, 10) ?? 'Never'} />
              <Detail label="Created" value={project.createdAt.slice(0, 10)} />
            </div>
          </Card>

          <section className="mt-8">
            <h2 className="border-b border-line pb-3 font-display text-2xl">
              Repository evidence
            </h2>
            <div className="mt-4">
              <RepositoryPanel projectId={projectId} />
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
