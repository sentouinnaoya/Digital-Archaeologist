'use client';

import { useEffect, useState } from 'react';
import {
  useDeleteReportMutation,
  useGenerateReportMutation,
  useGetReportQuery,
  useListReportsQuery,
} from '@/store/api/reportsApi';
import { Alert, Badge, EmptyState, Skeleton } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { formatDateTime } from '@/lib/format';
import { getErrorMessage } from '@/lib/types';

export function ReportPanel({ projectId }: { projectId: string }) {
  const { data: reports, isLoading } = useListReportsQuery(projectId);
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState('');
  const [generate, { isLoading: isGenerating }] = useGenerateReportMutation();
  const [deleteReport, { isLoading: isDeleting }] = useDeleteReportMutation();
  const { data: report, isFetching } = useGetReportQuery(selectedId, { skip: !selectedId });

  useEffect(() => {
    if (selectedId) return;
    const first = reports?.data[0];
    if (first) setSelectedId(first.id);
  }, [reports?.data, selectedId]);

  const create = async () => {
    setError('');
    try {
      const created = await generate({ projectId }).unwrap();
      setSelectedId(created.id);
    } catch (generateError) {
      setError(getErrorMessage(generateError));
    }
  };

  const remove = async () => {
    if (!selectedId) return;
    setError('');
    try {
      await deleteReport({ reportId: selectedId }).unwrap();
      setSelectedId('');
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    }
  };

  const download = () => {
    if (!report) return;
    const blob = new Blob([report.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${report.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="border border-line bg-paper-raised">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="font-display text-2xl">Evidence reports</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-soft">
            Markdown reports are assembled from stored project metadata and analysis results.
            Unavailable sections stay labelled unavailable; source code is neither quoted nor
            executed.
          </p>
        </div>
        <Button type="button" onClick={() => void create()} disabled={isGenerating}>
          {isGenerating ? 'Generating…' : 'Generate report'}
        </Button>
      </div>

      {error ? (
        <div className="px-5 pt-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      {isLoading ? (
        <div className="p-5">
          <Skeleton className="h-48 w-full" />
        </div>
      ) : !reports || reports.data.length === 0 ? (
        <div className="p-5">
          <EmptyState
            title="No reports recorded"
            description="Generate a report to assemble the currently stored evidence into a downloadable Markdown record."
          />
        </div>
      ) : (
        <div className="grid gap-0 lg:grid-cols-[18rem_1fr]">
          <div className="border-b border-line px-5 py-4 lg:border-b-0 lg:border-r">
            <ul className="space-y-2">
              {reports.data.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full border px-3 py-2 text-left text-xs ${
                      selectedId === item.id
                        ? 'border-ink bg-paper-sunken text-ink'
                        : 'border-line text-ink-soft hover:border-line-strong'
                    }`}
                  >
                    <span className="block font-display text-sm">{item.title}</span>
                    <span className="mt-1 block font-mono text-[0.65rem]">
                      {formatDateTime(item.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="px-5 py-4">
            {isFetching && !report ? (
              <Skeleton className="h-64 w-full" />
            ) : report ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-xl">{report.title}</h3>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="active">{report.evidenceIds.length} citations</Badge>
                    <Badge>{report.format}</Badge>
                    <Button variant="secondary" type="button" onClick={download}>
                      Download .md
                    </Button>
                    <Button
                      variant="danger"
                      type="button"
                      onClick={() => void remove()}
                      disabled={isDeleting}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                <pre className="mt-4 max-h-[32rem] overflow-auto border border-line bg-paper-sunken/40 p-4 text-xs leading-relaxed whitespace-pre-wrap text-ink">
                  {report.content}
                </pre>
                <p className="mt-3 text-xs leading-relaxed text-ink-soft">{report.basis}</p>
                {report.limits.map((limit) => (
                  <p key={limit} className="mt-1 text-xs text-clay-dark">
                    • {limit}
                  </p>
                ))}
              </>
            ) : (
              <p className="text-sm text-ink-soft">Select a report to read its stored content.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
