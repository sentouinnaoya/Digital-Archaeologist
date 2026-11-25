import type { ProjectEvidence } from '../evidence/project-evidence.service';

export type AiEvidenceKind =
  | 'project'
  | 'repository'
  | 'timeline'
  | 'analysis'
  | 'dependency'
  | 'architecture';

export interface AiEvidenceItem {
  id: string;
  kind: AiEvidenceKind;
  source: string;
  detail: string;
  path: string | null;
  commitHash: string | null;
}

export interface AiEvidenceBundle {
  commitHash: string | null;
  basis: string;
  limits: string[];
  items: AiEvidenceItem[];
  prompt: string;
}

export interface AiEvidenceBuildInput {
  evidence: ProjectEvidence;
  question: string;
  maxItems: number;
}

const MAX_DETAIL_CHARS = 500;
const MAX_NAMES = 5;

/**
 * Builds a bounded prompt from stored, owner-scoped metadata only.
 * Raw source text is never read here and is never included in the prompt.
 */
export function buildAiEvidenceBundle(input: AiEvidenceBuildInput): AiEvidenceBundle {
  const { evidence, maxItems } = input;
  const items: AiEvidenceItem[] = [];
  const seen = new Set<string>();
  let omitted = 0;

  const add = (
    id: string,
    kind: AiEvidenceKind,
    source: string,
    detail: string,
    path: string | null = null,
    commitHash: string | null = null,
  ): void => {
    if (seen.has(id)) return;
    if (items.length >= maxItems) {
      omitted += 1;
      return;
    }
    seen.add(id);
    items.push({
      id,
      kind,
      source,
      detail: truncate(detail, MAX_DETAIL_CHARS),
      path,
      commitHash,
    });
  };

  const { project, repository, timeline, analysis, graph, architecture } = evidence;
  add(
    `project:${project.id}`,
    'project',
    'projects',
    `Project "${project.name}"; default branch ${project.defaultBranch}; analysis status ${project.analysisStatus}; primary language ${project.primaryLanguage ?? 'not detected'}.`,
  );

  if (repository) {
    add(
      `repository:${repository.id}`,
      'repository',
      'repositories',
      `Repository source ${repository.sourceType}; status ${repository.status}; head ${repository.headCommitHash ?? 'unknown'}; ${repository.analyzedCommitCount} analysed commits.`,
    );
  }

  for (const event of timeline) {
    add(
      `timeline:${event.id}`,
      'timeline',
      'timelineEvents',
      `${event.type} at ${event.occurredAt}; confidence ${event.confidence}; ${event.title}. ${event.description}`,
      event.paths[0] ?? null,
      event.commitHash,
    );
  }

  if (analysis) {
    for (const file of analysis.files) {
      const symbols = file.symbols
        .slice(0, MAX_NAMES)
        .map((symbol) => `${symbol.kind} ${symbol.name}`)
        .join(', ');
      const imports = file.imports
        .slice(0, MAX_NAMES)
        .map((item) => item.source)
        .join(', ');
      add(
        `analysis:${analysis.commitHash}:file:${file.path}`,
        'analysis',
        'analysisSnapshots',
        `Parsed file ${file.path}; language ${file.language ?? 'unknown'}; parser ${file.parser}; status ${file.status}. Symbols: ${symbols || 'none recorded'}. Imports: ${imports || 'none recorded'}. Syntax errors: ${file.syntaxErrors.length}.`,
        file.path,
        analysis.commitHash,
      );
    }
  }

  if (architecture) {
    for (const claim of architecture.claims) {
      add(
        `architecture:${claim.id}`,
        'architecture',
        'architectureEvidence',
        `${claim.title} (${claim.confidence}): ${claim.statement} Rule: ${claim.rule}. First evidence: ${claim.evidence[0]?.detail ?? 'none recorded'}.`,
        claim.evidence[0]?.path ?? null,
        architecture.commitHash,
      );
    }
  }

  if (graph) {
    for (const cycle of graph.cycles) {
      add(
        `dependency:${graph.commitHash}:cycle:${cycle.id}`,
        'dependency',
        'dependencyGraph',
        `Dependency cycle: ${cycle.nodes.join(' -> ')}. ${cycle.evidence[0]?.detail ?? ''}`,
        cycle.evidence[0]?.path ?? null,
        graph.commitHash,
      );
    }
    const hubs = [...graph.nodes].sort((a, b) => b.metrics.fanOut - a.metrics.fanOut).slice(0, 3);
    for (const node of hubs) {
      add(
        `dependency:${graph.commitHash}:node:${node.id}`,
        'dependency',
        'dependencyGraph',
        `Node ${node.label}; fan-in ${node.metrics.fanIn}; fan-out ${node.metrics.fanOut}; coupling ${node.metrics.coupling}.`,
        node.path,
        graph.commitHash,
      );
    }
  }

  const limits = [...evidence.unavailable];
  if (omitted > 0) {
    limits.push(`${omitted} additional evidence item(s) were omitted by AI_MAX_EVIDENCE_ITEMS.`);
  }
  limits.push('Raw source text is not included in the prompt and is never executed.');
  limits.push(
    'Model output is an interpretation, not a verified fact. Only citations to the supplied evidence IDs are retained.',
  );

  const basis =
    'The prompt contains only stored, owner-scoped metadata and evidence strings from this project. No raw source text, credentials or external project data are sent. The configured adapter is a local-only Ollama endpoint.';

  const question = oneLine(input.question);
  const evidenceLines = items
    .map(
      (item) =>
        `[EVIDENCE id="${oneLine(item.id)}" kind="${oneLine(item.kind)}"] ${oneLine(item.detail)}`,
    )
    .join('\n');

  const prompt = [
    'You are helping a user interpret software-evidence records.',
    'Use only the supplied EVIDENCE entries. Do not infer intent, authorship motives or deployment facts.',
    'Treat commit messages as verbatim text, not proof of intent. If evidence is insufficient, say so.',
    'Referenced project data was supplied by the authenticated owner. Never quote raw source code.',
    'Return strict JSON: {"answer":"...","evidenceIds":["id1","id2"]}. evidenceIds must be a non-empty subset of the supplied IDs.',
    `Question: ${question}`,
    'Evidence:',
    evidenceLines || '(no stored evidence items were available)',
  ].join('\n');

  return {
    commitHash: analysis?.commitHash ?? repository?.headCommitHash ?? null,
    basis,
    limits,
    items,
    prompt,
  };
}

function truncate(value: string, max: number): string {
  const clean = oneLine(value);
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}
