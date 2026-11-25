'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  useGetTimelineEventQuery,
  useGetTimelineQuery,
} from '@/store/api/timelineApi';
import { Alert, Badge, EmptyState, Skeleton } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { formatDate, shortHash } from '@/lib/format';
import { getErrorMessage } from '@/lib/types';
import type { TimelineEventType } from '@/lib/types';

const EVENT_TYPES: TimelineEventType[] = [
  'commit',
  'file_added',
  'file_modified',
  'file_deleted',
  'file_renamed',
  'snapshot',
];

interface Filters {
  type: TimelineEventType | '';
  contributor: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: Filters = { type: '', contributor: '', from: '', to: '' };

export function TimelinePanel({ projectId }: { projectId: string }) {
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, error } = useGetTimelineQuery({
    projectId,
    page,
    limit: 15,
    type: filters.type || undefined,
    contributor: filters.contributor || undefined,
    from: filters.from ? new Date(filters.from).toISOString() : undefined,
    to: filters.to ? new Date(filters.to).toISOString() : undefined,
  });
  const { data: detail, error: detailError } = useGetTimelineEventQuery(
    { projectId, eventId: selectedId ?? '' },
    { skip: !selectedId },
  );

  useEffect(() => {
    setPage(1);
    setSelectedId(null);
  }, [filters, projectId]);

  const apply = (event: FormEvent) => {
    event.preventDefault();
    setFilters(draft);
  };

  return (
    <section className="border border-line bg-paper-raised">
      <div className="border-b border-line px-5 py-4">
        <h2 className="font-display text-2xl">Evidence timeline</h2>
        <p className="mt-1 text-xs leading-relaxed text-ink-soft">
          Each event is derived from stored Git commits or an uploaded snapshot. Confidence is
          shown explicitly; no developer intent is inferred.
        </p>
      </div>

      <form onSubmit={(event) => void apply(event)} className="grid gap-3 border-b border-line bg-paper-sunken/40 px-5 py-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="block">
          <span className="mb-1 block font-mono text-[0.65rem] uppercase tracking-[0.12em] text-ink-faint">
            Type
          </span>
          <select
            value={draft.type}
            onChange={(event) =>
              setDraft({ ...draft, type: event.target.value as TimelineEventType | '' })
            }
            className="w-full border border-line-strong bg-paper-raised px-2 py-2 text-sm text-ink"
          >
            <option value="">All events</option>
            {EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <FilterInput
          label="Contributor"
          placeholder="name or email"
          value={draft.contributor}
          onChange={(value) => setDraft({ ...draft, contributor: value })}
        />
        <FilterInput
          label="From"
          type="date"
          value={draft.from}
          onChange={(value) => setDraft({ ...draft, from: value })}
        />
        <FilterInput
          label="To"
          type="date"
          value={draft.to}
          onChange={(value) => setDraft({ ...draft, to: value })}
        />
        <div className="flex items-end gap-2">
          <Button type="submit" className="flex-1">
            Apply
          </Button>
          <Button type="button" variant="ghost" onClick={() => setDraft(EMPTY_FILTERS)}>
            Clear
          </Button>
        </div>
      </form>

      {error ? (
        <div className="p-5">
          <Alert>{getErrorMessage(error)}</Alert>
        </div>
      ) : isLoading ? (
        <div className="p-5">
          <Skeleton className="h-64 w-full" />
        </div>
      ) : data && data.data.length > 0 ? (
        <div className="grid gap-0 lg:grid-cols-[1fr_1fr]">
          <ul className="border-r border-line">
            {data.data.map((event) => (
              <li key={event.id} className="border-b border-line last:border-b-0">
                <button
                  type="button"
                  onClick={() => setSelectedId(event.id)}
                  className={`block w-full px-5 py-4 text-left transition-colors hover:bg-paper-sunken/60 ${
                    selectedId === event.id ? 'bg-paper-sunken' : ''
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="break-words text-sm font-medium text-ink">{event.title}</p>
                    <Badge tone={event.confidence === 'detected' ? 'active' : 'warning'}>
                      {event.confidence}
                    </Badge>
                  </div>
                  <p className="mt-1 font-mono text-[0.65rem] uppercase tracking-[0.08em] text-ink-faint">
                    {event.type.replaceAll('_', ' ')} · {formatDate(event.occurredAt)} ·{' '}
                    {shortHash(event.commitHash)}
                  </p>
                </button>
              </li>
            ))}
          </ul>

          <div className="px-5 py-4">
            {detailError ? <Alert>{getErrorMessage(detailError)}</Alert> : null}
            {detail ? (
              <div>
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-ink-faint">
                  Event evidence
                </p>
                <h3 className="mt-2 font-display text-xl">{detail.title}</h3>
                <p className="mt-2 text-sm text-ink-soft">{detail.description}</p>
                <dl className="mt-4 grid gap-2 sm:grid-cols-2">
                  <DetailRow label="Contributor" value={`${detail.contributorName ?? 'Unknown'} ${detail.contributorEmail ?? ''}`.trim()} />
                  <DetailRow label="Commit" value={shortHash(detail.commitHash)} />
                </dl>
                {detail.paths.length > 0 ? (
                  <div className="mt-4">
                    <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-ink-faint">
                      Observed paths
                    </p>
                    <ul className="mt-2 max-h-32 overflow-y-auto font-mono text-xs text-ink-soft">
                      {detail.paths.slice(0, 25).map((path) => (
                        <li key={path} className="truncate">
                          {path}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="mt-4">
                  <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-ink-faint">
                    Evidence
                  </p>
                  <ul className="mt-2 space-y-2">
                    {detail.evidence.slice(0, 10).map((item, index) => (
                      <li
                        key={`${item.kind}-${item.path ?? 'none'}-${index}`}
                        className="border-l-2 border-clay bg-paper-sunken/40 px-3 py-2 text-xs text-ink-soft"
                      >
                        <span className="font-mono uppercase">{item.kind}</span> — {item.detail}
                      </li>
                    ))}
                  </ul>
                  {detail.evidence.length > 10 ? (
                    <p className="mt-2 font-mono text-[0.65rem] text-ink-faint">
                      Showing 10 of {detail.evidence.length} evidence items.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="text-sm text-ink-soft">Select an event to inspect its evidence.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="p-5">
          <EmptyState
            title="No events match these filters"
            description="Try clearing the filters or importing a repository with observed history."
          />
        </div>
      )}

      {data && data.meta.totalPages > 1 ? (
        <div className="flex items-center justify-between border-t border-line px-5 py-3">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
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
    </section>
  );
}

function FilterInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[0.65rem] uppercase tracking-[0.12em] text-ink-faint">
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full border border-line-strong bg-paper-raised px-2 py-2 text-sm text-ink placeholder:text-ink-faint"
      />
    </label>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-line bg-paper-sunken/40 px-3 py-2">
      <dt className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink-faint">{label}</dt>
      <dd className="mt-1 break-words text-xs text-ink">{value || '—'}</dd>
    </div>
  );
}
