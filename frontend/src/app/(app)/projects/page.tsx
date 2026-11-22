'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import {
  useCreateProjectMutation,
  useGetProjectsQuery,
} from '@/store/api/projectsApi';
import { Alert, Badge, EmptyState, Skeleton } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { getErrorMessage } from '@/lib/types';

export default function ProjectsPage() {
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ name: '', description: '' });
  const { data, isLoading, error } = useGetProjectsQuery({ page, limit: 10 });
  const [createProject, { isLoading: creating, error: createError }] =
    useCreateProjectMutation();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await createProject({ name: form.name, description: form.description }).unwrap();
      setForm({ name: '', description: '' });
      setPage(1);
    } catch {
      // Displayed through createError.
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <header className="border-b border-line pb-7">
        <p className="eyebrow">Project registry</p>
        <h1 className="mt-3 font-display text-4xl tracking-tight">Projects</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
          Establish a record for each codebase you intend to study. Repository import is
          attached to a project in Phase 2.
        </p>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[340px_1fr]">
        <Card className="h-fit p-5">
          <h2 className="font-display text-xl">New project record</h2>
          <form onSubmit={(event) => void submit(event)} className="mt-5 space-y-4">
            {createError ? <Alert>{getErrorMessage(createError)}</Alert> : null}
            <Field
              label="Project name"
              required
              minLength={2}
              maxLength={120}
              value={form.name}
              placeholder="e.g. Legacy Payments Service"
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
            <label className="block">
              <span className="mb-1.5 block font-mono text-[0.7rem] uppercase tracking-[0.12em] text-ink-soft">
                Description
              </span>
              <textarea
                rows={3}
                maxLength={2000}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                className="w-full resize-y border border-line-strong bg-paper-raised px-3 py-2.5 text-sm focus:border-clay focus:outline-none"
              />
            </label>
            <Button type="submit" disabled={creating} className="w-full">
              {creating ? 'Saving…' : 'Create project'}
            </Button>
          </form>
        </Card>

        <div>
          <div className="flex items-center justify-between border-b border-line pb-3">
            <h2 className="font-display text-2xl">Registered projects</h2>
            {data ? (
              <span className="font-mono text-[0.7rem] text-ink-faint">
                {data.meta.total} RECORD(S)
              </span>
            ) : null}
          </div>

          {error ? (
            <div className="mt-4">
              <Alert>{getErrorMessage(error)}</Alert>
            </div>
          ) : null}

          <div className="mt-4">
            {isLoading ? (
              <Skeleton className="h-48" />
            ) : data && data.data.length > 0 ? (
              <>
                <ul className="border border-line bg-paper-raised">
                  {data.data.map((project) => (
                    <li key={project.id} className="border-b border-line last:border-b-0">
                      <Link
                        href={`/projects/${project.id}`}
                        className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-paper-sunken/50"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{project.name}</p>
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-soft">
                            {project.description || 'No description recorded.'}
                          </p>
                          <p className="mt-2 font-mono text-[0.65rem] text-ink-faint">
                            {project.id} · {project.createdAt.slice(0, 10)}
                          </p>
                        </div>
                        <Badge>{project.analysisStatus.replace('_', ' ')}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
                {data.meta.totalPages > 1 ? (
                  <div className="mt-4 flex items-center justify-between">
                    <Button
                      variant="secondary"
                      disabled={page <= 1}
                      onClick={() => setPage((value) => value - 1)}
                    >
                      Previous
                    </Button>
                    <span className="font-mono text-xs text-ink-soft">
                      PAGE {page} / {data.meta.totalPages}
                    </span>
                    <Button
                      variant="secondary"
                      disabled={page >= data.meta.totalPages}
                      onClick={() => setPage((value) => value + 1)}
                    >
                      Next
                    </Button>
                  </div>
                ) : null}
              </>
            ) : (
              <EmptyState
                title="The registry is empty"
                description="Create your first project record using the form. No sample projects are generated."
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
