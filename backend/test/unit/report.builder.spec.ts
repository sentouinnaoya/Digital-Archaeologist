import { buildProjectReport } from '../../src/modules/reports/report.builder';
import type { ProjectEvidence } from '../../src/modules/evidence/project-evidence.service';

const evidence = {
  project: {
    id: '507f191e810c19729de860ea',
    name: 'Archaeology Demo',
    description: '',
    repositoryUrl: null,
    defaultBranch: 'main',
    primaryLanguage: 'TypeScript',
    analysisStatus: 'completed',
    lastAnalyzedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  },
  repository: {
    id: '507f1f77bcf86cd799439011',
    projectId: '507f191e810c19729de860ea',
    sourceType: 'git_url',
    status: 'ready',
    analyzedCommitCount: 1,
    snapshotFileCount: 0,
    headCommitHash: 'aaa111',
  },
  timeline: [
    {
      id: '507f1f77bcf86cd799439012',
      type: 'commit',
      occurredAt: '2026-01-02T00:00:00.000Z',
      title: 'A commit happened',
      description: 'Verbatim commit message',
      confidence: 'detected',
      commitHash: 'aaa111',
      contributorEmail: null,
      contributorName: null,
      paths: ['src/app.ts'],
      evidence: [],
    },
  ],
  analysis: {
    id: 'snapshot1',
    commitHash: 'aaa111',
    files: [
      {
        path: 'src/app.ts',
        language: 'TypeScript',
        parser: 'tree-sitter-typescript',
        status: 'parsed',
        size: 200,
        symbols: [{ name: 'App', kind: 'class', startLine: 1, endLine: 3 }],
        imports: [],
        modules: [],
        syntaxErrors: [],
        truncated: false,
      },
    ],
    summary: {
      fileCount: 1,
      parsedCount: 1,
      syntaxErrorCount: 0,
      unsupportedCount: 0,
      failedCount: 0,
      symbolCount: 1,
      importCount: 0,
      fileLimitApplied: false,
    },
  },
  graph: {
    commitHash: 'aaa111',
    cycles: [],
    metrics: { nodeCount: 1, edgeCount: 0, cycleCount: 0, averageCoupling: 0, maxFanOut: 0 },
  },
  architecture: {
    commitHash: 'aaa111',
    claims: [],
    metrics: { moduleCount: 0, claimCount: 0, crossModuleEdgeCount: 0 },
  },
  unavailable: [],
} as unknown as ProjectEvidence;

describe('buildProjectReport', () => {
  const generatedAt = new Date('2026-02-01T00:00:00.000Z');

  it('assembles a cited Markdown report without source text', () => {
    const report = buildProjectReport({ evidence, generatedAt, maxItems: 20 });

    expect(report.title).toBe('Project report: Archaeology Demo');
    expect(report.content).toContain('## Repository evidence');
    expect(report.content).toContain('## Timeline evidence');
    expect(report.content).toContain('evidence: `project:507f191e810c19729de860ea`');
    expect(report.evidenceIds).toEqual(
      expect.arrayContaining(['analysis:aaa111:file:src/app.ts']),
    );
    expect(report.content).not.toContain('export class App');
    expect(report.basis).toContain('stored, owner-scoped');
  });

  it('caps evidence lines and reports the omission', () => {
    const report = buildProjectReport({ evidence, generatedAt, maxItems: 1 });

    expect(report.evidenceIds).toHaveLength(1);
    expect(report.limits.join(' ')).toContain('REPORT_MAX_ITEMS');
  });

  it('labels absent analysis rather than filling it in', () => {
    const report = buildProjectReport({
      evidence: { ...evidence, analysis: null, graph: null, architecture: null },
      generatedAt,
      maxItems: 20,
    });

    expect(report.content).toContain('Unavailable: no stored source analysis');
    expect(report.evidenceIds.some((id) => id.startsWith('analysis:'))).toBe(false);
  });
});
