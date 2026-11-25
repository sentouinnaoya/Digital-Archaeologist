'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  useDeleteAiConversationMutation,
  useGetAiConversationQuery,
  useGetAiStatusQuery,
  useListAiConversationsQuery,
  useSendAiMessageMutation,
} from '@/store/api/aiApi';
import { Alert, Badge, EmptyState, Skeleton } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { formatDateTime } from '@/lib/format';
import { getErrorMessage } from '@/lib/types';
import type { AiChatResult } from '@/lib/types';

export function AiAssistantPanel({ projectId }: { projectId: string }) {
  const { data: status, isLoading: statusLoading } = useGetAiStatusQuery(projectId);
  const { data: conversations } = useListAiConversationsQuery(projectId, {
    skip: !status?.enabled,
  });
  const [selectedId, setSelectedId] = useState('');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [latest, setLatest] = useState<AiChatResult | null>(null);
  const [sendMessage, { isLoading: isSending }] = useSendAiMessageMutation();
  const [deleteConversation, { isLoading: isDeleting }] = useDeleteAiConversationMutation();

  const { data: conversation, isFetching: conversationLoading } = useGetAiConversationQuery(
    selectedId,
    { skip: !selectedId },
  );

  useEffect(() => {
    if (selectedId) return;
    const first = conversations?.data[0];
    if (first) setSelectedId(first.id);
  }, [conversations?.data, selectedId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!message.trim() || !consent) return;
    try {
      const result = await sendMessage({
        projectId,
        message: message.trim(),
        conversationId: selectedId || undefined,
        consent: true,
      }).unwrap();
      setLatest(result);
      setSelectedId(result.conversationId);
      setMessage('');
    } catch (sendError) {
      setError(getErrorMessage(sendError));
    }
  };

  const remove = async () => {
    if (!selectedId) return;
    setError('');
    try {
      await deleteConversation({ conversationId: selectedId }).unwrap();
      setSelectedId('');
      setLatest(null);
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    }
  };

  return (
    <section className="border border-line bg-paper-raised">
      <div className="border-b border-line px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-2xl">Evidence assistant</h2>
          <Badge tone={status?.enabled ? 'active' : 'warning'}>
            {status?.enabled ? 'opt-in available' : 'disabled by default'}
          </Badge>
        </div>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-ink-soft">
          Answers are interpretations, not verified facts. The local-only adapter receives stored
          metadata and evidence strings; raw source text is never sent, stored or executed. Every
          retained answer must cite supplied evidence IDs.
        </p>
      </div>

      {statusLoading ? (
        <div className="p-5">
          <Skeleton className="h-40 w-full" />
        </div>
      ) : !status?.enabled ? (
        <div className="p-5">
          <EmptyState
            title="Assistant unavailable"
            description={
              status?.basis ??
              'The assistant is disabled. Configure a local Ollama endpoint and enable AI_ENABLED to use it.'
            }
          />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3 border-b border-line bg-paper-sunken/40 px-5 py-4">
            <label className="min-w-[14rem] flex-1">
              <span className="mb-1 block font-mono text-[0.65rem] uppercase tracking-[0.12em] text-ink-faint">
                Conversation
              </span>
              <select
                value={selectedId}
                onChange={(event) => {
                  setSelectedId(event.target.value);
                  setLatest(null);
                }}
                className="w-full border border-line-strong bg-paper-raised px-2 py-2 text-xs text-ink"
              >
                <option value="">New conversation</option>
                {(conversations?.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="danger"
              type="button"
              onClick={() => void remove()}
              disabled={!selectedId || isDeleting}
            >
              Delete conversation
            </Button>
          </div>

          <div className="max-h-96 space-y-3 overflow-y-auto px-5 py-4">
            {conversationLoading && !conversation ? (
              <Skeleton className="h-32 w-full" />
            ) : !conversation ? (
              <p className="text-sm text-ink-soft">
                Ask a question about stored commits, structure, dependencies or architecture
                evidence.
              </p>
            ) : (
              conversation.messages.map((item, index) => (
                <div key={`${item.createdAt}-${index}`} className="border border-line px-3 py-2">
                  <p className="font-mono text-[0.65rem] uppercase tracking-[0.12em] text-ink-faint">
                    {item.role} · {formatDateTime(item.createdAt)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{item.content}</p>
                  {item.evidenceIds.length > 0 ? (
                    <p className="mt-1 break-all font-mono text-[0.65rem] text-ink-soft">
                      cites: {item.evidenceIds.join(', ')}
                    </p>
                  ) : null}
                </div>
              ))
            )}
          </div>

          {latest ? (
            <div className="border-t border-line bg-paper-sunken/30 px-5 py-4">
              <h3 className="font-mono text-[0.65rem] uppercase tracking-[0.12em] text-ink-faint">
                Retained citations
              </h3>
              <ul className="mt-2 space-y-2">
                {latest.evidence.map((item) => (
                  <li key={item.id} className="border border-line px-3 py-2">
                    <p className="font-mono text-[0.7rem] text-ink">
                      {item.id} · {item.kind} · {item.source}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-soft">{item.detail}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs leading-relaxed text-ink-soft">{latest.basis}</p>
              {latest.limits.map((limit) => (
                <p key={limit} className="mt-1 text-xs text-clay-dark">
                  • {limit}
                </p>
              ))}
            </div>
          ) : null}

          {error ? (
            <div className="px-5 pt-4">
              <Alert>{error}</Alert>
            </div>
          ) : null}

          <form
            onSubmit={(event) => void submit(event)}
            className="space-y-3 border-t border-line px-5 py-4"
          >
            <label className="block">
              <span className="mb-1 block font-mono text-[0.65rem] uppercase tracking-[0.12em] text-ink-faint">
                Question
              </span>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Ask about the stored evidence for this project"
                className="w-full border border-line-strong bg-paper-raised px-3 py-2 text-sm text-ink"
              />
            </label>
            <label className="flex items-start gap-2 text-xs leading-relaxed text-ink-soft">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                className="mt-0.5"
              />
              I consent to sending this question and the selected stored evidence to the configured
              local model. Raw source text is not included.
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={!message.trim() || !consent || isSending}>
                {isSending ? 'Asking…' : 'Ask with evidence'}
              </Button>
              <span className="text-xs text-ink-faint">
                Model: <span className="font-mono">{status.model}</span>
              </span>
            </div>
          </form>
        </>
      )}
    </section>
  );
}
