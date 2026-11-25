import { buildAiEvidenceBundle } from '../../src/modules/ai-assistant/ai-evidence.builder';
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
  repository: null,
  timeline: [
    {
      id: '507f1f77bcf86cd799439011',
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
    repositoryId: 'repo1',
    projectId: '507f191e810c19729de860ea',
    sourceType: 'git_url',
    commitHash: 'aaa111',
    analyzerVersion: '0.1.0',
    cached: false,
    files: [
      {
        path: 'src/app.ts',
        language: 'TypeScript',
        parser: 'tree-sitter-typescript',
        status: 'parsed',
        size: 200,
        symbols: [{ name: 'App', kind: 'class', startLine: 1, endLine: 3 }],
        imports: [{ source: 'react', kind: 'static', names: [], line: 1 }],
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
      importCount: 1,
      fileLimitApplied: false,
    },
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  },
  graph: null,
  architecture: null,
  unavailable: [],
} as unknown as ProjectEvidence;

describe('buildAiEvidenceBundle', () => {
  it('builds a bounded prompt from metadata without embedding source text', () => {
    const bundle = buildAiEvidenceBundle({
      evidence,
      question: 'What changed?',
      maxItems: 20,
    });

    expect(bundle.items.length).toBeGreaterThan(0);
    expect(bundle.items.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        'project:507f191e810c19729de860ea',
        'timeline:507f1f77bcf86cd799439011',
        'analysis:aaa111:file:src/app.ts',
      ]),
    );
    expect(bundle.prompt).toContain('[EVIDENCE id="analysis:aaa111:file:src/app.ts"');
    expect(bundle.prompt).toContain('"evidenceIds":["id1","id2"]');
    expect(bundle.prompt).not.toContain('return');
    expect(bundle.basis).toContain('No raw source text');
  });

  it('reports omitted evidence when the configured cap is reached', () => {
    const bundle = buildAiEvidenceBundle({ evidence, question: 'Summarise', maxItems: 1 });

    expect(bundle.items).toHaveLength(1);
    expect(bundle.limits.join(' ')).toContain('AI_MAX_EVIDENCE_ITEMS');
  });

  it('propagates unavailable evidence instead of inventing facts', () => {
    const bundle = buildAiEvidenceBundle({
      evidence: { ...evidence, analysis: null, unavailable: ['No stored analysis.'] },
      question: 'What changed?',
      maxItems: 20,
    });

    expect(bundle.limits).toContain('No stored analysis.');
    expect(bundle.items.some((item) => item.kind === 'analysis')).toBe(false);
  });
});
