import type { ProjectEvidence } from '../evidence/project-evidence.service';

export interface BuiltReport {
  title: string;
  content: string;
  basis: string;
  evidenceIds: string[];
  limits: string[];
}

export interface ReportBuildInput {
  evidence: ProjectEvidence;
  generatedAt: Date;
  maxItems: number;
}

interface EvidenceLineState {
  lines: string[];
  evidenceIds: string[];
  omitted: number;
}

/**
 * Deterministic Markdown assembled only from owner-scoped stored metadata.
 * It never reads, quotes or executes imported source text.
 */
export function buildProjectReport(input: ReportBuildInput): BuiltReport {
  const { evidence, generatedAt, maxItems } = input;
  const state: EvidenceLineState = { lines: [], evidenceIds: [], omitted: 0 };
  const lines: string[] = [
    `# Project report: ${oneLine(evidence.project.name)}`,
    '',
    `Generated at: ${generatedAt.toISOString()}`,
    '',
    '> This report contains stored evidence only. It makes no claim about developer intent, deployment topology or code correctness.',
  ];

  const record = (id: string, text: string): void => {
    if (state.evidenceIds.includes(id)) return;
    if (state.evidenceIds.length >= maxItems) {
      state.omitted += 1;
      return;
    }
    state.evidenceIds.push(id);
    state.lines.push(`- ${text} (evidence: \`${id}\`)`);
  };

  const flush = (): void => {
    if (state.lines.length === 0) return;
    lines.push('', ...state.lines);
    state.lines.length = 0;
  };

  lines.push(
    '',
    '## Project record',
    '',
    `- Name: ${oneLine(evidence.project.name)}`,
    `- Default branch: ${oneLine(evidence.project.defaultBranch)}`,
    `- Analysis status: ${oneLine(evidence.project.analysisStatus)}`,
    `- Primary language: ${oneLine(evidence.project.primaryLanguage ?? 'not detected')}`,
    `- Project ID: \`${evidence.project.id}\``,
  );
  record(
    `project:${evidence.project.id}`,
    `Stored project record for ${oneLine(evidence.project.name)}`,
  );
  flush();

  lines.push('', '## Repository evidence', '');
  if (evidence.repository) {
    const repository = evidence.repository;
    lines.push(
      `- Source type: ${repository.sourceType}`,
      `- Status: ${repository.status}`,
      `- Head commit: \`${repository.headCommitHash ?? 'unknown'}\``,
      `- Analysed commits: ${repository.analyzedCommitCount}`,
      `- Snapshot files: ${repository.snapshotFileCount}`,
    );
    record(
      `repository:${repository.id}`,
      `${repository.sourceType} repository with ${repository.analyzedCommitCount} analysed commit(s)`,
    );
  } else {
    lines.push('- Unavailable: no repository has been imported for this project.');
  }
  flush();

  lines.push('', '## Timeline evidence', '');
  if (evidence.timeline.length === 0) {
    lines.push('- No timeline events were available.');
  } else {
    for (const event of evidence.timeline) {
      record(
        `timeline:${event.id}`,
        `${event.type} at ${event.occurredAt}; confidence ${event.confidence}; ${oneLine(event.description)}`,
      );
    }
  }
  flush();

  lines.push('', '## Source analysis', '');
  if (evidence.analysis) {
    const { summary, commitHash } = evidence.analysis;
    lines.push(
      `- Commit: \`${commitHash}\``,
      `- Files: ${summary.fileCount}; parsed: ${summary.parsedCount}; syntax errors: ${summary.syntaxErrorCount}`,
      `- Symbols: ${summary.symbolCount}; imports: ${summary.importCount}`,
      `- File limit applied: ${summary.fileLimitApplied ? 'yes' : 'no'}`,
    );
    for (const file of evidence.analysis.files) {
      record(
        `analysis:${commitHash}:file:${file.path}`,
        `${oneLine(file.path)}: ${file.status}, ${file.symbols.length} symbol(s), ${file.imports.length} import(s)`,
      );
    }
  } else {
    lines.push('- Unavailable: no stored source analysis for this project.');
  }
  flush();

  lines.push('', '## Dependency graph', '');
  if (evidence.graph) {
    const { metrics, commitHash } = evidence.graph;
    lines.push(
      `- Nodes: ${metrics.nodeCount}; edges: ${metrics.edgeCount}; cycles: ${metrics.cycleCount}`,
      `- Average coupling: ${metrics.averageCoupling}; max fan-out: ${metrics.maxFanOut}`,
    );
    for (const cycle of evidence.graph.cycles) {
      record(
        `dependency:${commitHash}:cycle:${cycle.id}`,
        `Dependency cycle: ${cycle.nodes.join(' -> ')}`,
      );
    }
  } else {
    lines.push('- Unavailable: no dependency graph for the analysed commit.');
  }
  flush();

  lines.push('', '## Architecture evidence', '');
  if (evidence.architecture) {
    const { metrics, commitHash } = evidence.architecture;
    lines.push(
      `- Modules: ${metrics.moduleCount}; claims: ${metrics.claimCount}; cross-module edges: ${metrics.crossModuleEdgeCount}`,
    );
    for (const claim of evidence.architecture.claims) {
      record(
        `architecture:${claim.id}`,
        `${oneLine(claim.title)} (${claim.confidence}): ${oneLine(claim.statement)}`,
      );
    }
  } else {
    lines.push('- Unavailable: no architecture evidence for the analysed commit.');
  }
  flush();

  const limits = [...evidence.unavailable];
  if (state.omitted > 0) {
    limits.push(`${state.omitted} additional evidence line(s) were omitted by REPORT_MAX_ITEMS.`);
  }
  limits.push(
    'Source code is neither quoted nor executed. Unavailable sections are not filled with inferred results.',
  );

  const basis =
    'Generated from stored, owner-scoped project metadata and analysis results. Interpretations are not presented as verified historical facts.';

  lines.push('', '## Evidence boundaries', '', basis, '');
  for (const limit of limits) lines.push(`- ${limit}`);

  return {
    title: `Project report: ${oneLine(evidence.project.name)}`,
    content: lines.join('\n'),
    basis,
    evidenceIds: state.evidenceIds,
    limits,
  };
}

function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}
