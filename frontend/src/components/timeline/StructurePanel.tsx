'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useGetProjectStructureQuery } from '@/store/api/timelineApi';
import { Alert, Badge, Skeleton } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { getErrorMessage } from '@/lib/types';
import type { StructureNode } from '@/lib/types';

export function StructurePanel({
  projectId,
  headCommitHash,
  sourceType,
}: {
  projectId: string;
  headCommitHash: string | null;
  sourceType: 'git_url' | 'zip';
}) {
  const [input, setInput] = useState(headCommitHash ?? '');
  const [commitHash, setCommitHash] = useState(headCommitHash ?? '');

  useEffect(() => {
    setInput(headCommitHash ?? '');
    setCommitHash(headCommitHash ?? '');
  }, [headCommitHash]);

  const { data, isLoading, error } = useGetProjectStructureQuery(
    { projectId, at: commitHash },
    { skip: sourceType === 'zip' || !commitHash },
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setCommitHash(input.trim());
  };

  return (
    <section className="border border-line bg-paper-raised">
      <div className="border-b border-line px-5 py-4">
        <h2 className="font-display text-2xl">Historical structure</h2>
        <p className="mt-1 text-xs leading-relaxed text-ink-soft">
          Reconstructed by replaying observed file changes up to the selected commit.
        </p>
      </div>

      {sourceType === 'zip' ? (
        <p className="px-5 py-6 text-sm text-ink-soft">
          Git structure is unavailable for ZIP snapshots. Only the observed file inventory is
          shown on the project record.
        </p>
      ) : (
        <>
          <form onSubmit={(event) => void submit(event)} className="flex flex-wrap items-end gap-2 border-b border-line bg-paper-sunken/40 px-5 py-4">
            <label className="min-w-[16rem] flex-1">
              <span className="mb-1 block font-mono text-[0.65rem] uppercase tracking-[0.12em] text-ink-faint">
                Commit hash
              </span>
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Full or analysed commit hash"
                className="w-full border border-line-strong bg-paper-raised px-2 py-2 font-mono text-xs text-ink"
              />
            </label>
            <Button type="submit" disabled={!input.trim()}>
              Reconstruct
            </Button>
          </form>

          {error ? (
            <div className="p-5">
              <Alert>{getErrorMessage(error)}</Alert>
            </div>
          ) : isLoading ? (
            <div className="p-5">
              <Skeleton className="h-48 w-full" />
            </div>
          ) : data ? (
            <div className="px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-[0.7rem] text-ink-soft">
                  {data.analyzedCommitCount} analysed commit(s) · {data.fileCount} observed file(s)
                </p>
                <Badge tone="active">{data.confidence}</Badge>
              </div>
              <ul className="mt-4 max-h-72 overflow-y-auto border border-line bg-paper-sunken/30 p-3 font-mono text-xs text-ink-soft">
                {data.root.children.map((node) => (
                  <TreeNode key={node.path} node={node} depth={0} />
                ))}
              </ul>
              <p className="mt-3 text-xs leading-relaxed text-ink-soft">{data.basis}</p>
            </div>
          ) : (
            <p className="px-5 py-6 text-sm text-ink-soft">
              Enter a commit hash from the analysed history.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function TreeNode({ node, depth }: { node: StructureNode; depth: number }) {
  return (
    <li>
      <div className="py-0.5" style={{ paddingLeft: `${depth * 14}px` }}>
        <span className={node.type === 'directory' ? 'text-clay-dark' : ''}>
          {node.type === 'directory' ? '▸ ' : '· '}
          {node.name}
        </span>
        {node.lastObservedCommitHash ? (
          <span className="ml-2 text-ink-faint">
            [{node.lastObservedStatus} {node.lastObservedCommitHash.slice(0, 8)}]
          </span>
        ) : null}
      </div>
      {node.children.length > 0 ? (
        <ul>
          {node.children.map((child) => (
            <TreeNode key={child.path} node={child} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
