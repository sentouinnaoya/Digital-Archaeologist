import type { ParsedSourceFileRecord } from '../code-analysis/schemas/analysis-snapshot.schema';
import type { GraphComparison } from '../dependency-analysis/dependency-graph.builder';
import type { ReconstructedStructure, StructureNode } from '../timeline/structure.builder';

export interface ComparisonCommit {
  hash: string;
  message: string;
  authorName: string;
  authorEmail: string;
  authoredAt: string;
  committedAt: string;
  parentHashes: string[];
  fileChanges: Array<{ status: string; path: string }>;
}

export interface ComparisonFileChange {
  status: string;
  path: string;
}

export interface StructureDiff {
  addedPaths: string[];
  removedPaths: string[];
  retainedPathCount: number;
  basis: string;
}

export interface SymbolChange {
  path: string;
  name: string;
  kind: string;
  line: number;
}

export interface SymbolDiff {
  added: SymbolChange[];
  removed: SymbolChange[];
  basis: string;
}

export interface CommitComparison {
  fromCommitHash: string;
  toCommitHash: string;
  basis: string;
  from: ComparisonCommit;
  to: ComparisonCommit;
  fileChanges: ComparisonFileChange[];
  structure: StructureDiff;
  symbols: SymbolDiff | null;
  dependencies: GraphComparison | null;
  limits: string[];
}

export interface CommitComparisonInput {
  fromCommit: ComparisonCommit;
  toCommit: ComparisonCommit;
  fileChanges: ComparisonFileChange[];
  fromStructure: ReconstructedStructure;
  toStructure: ReconstructedStructure;
  fromFiles?: ParsedSourceFileRecord[];
  toFiles?: ParsedSourceFileRecord[];
  dependencies?: GraphComparison | null;
  limits: string[];
}

export type SourceDiffRowKind = 'context' | 'added' | 'removed' | 'changed';

export interface SourceDiffRow {
  kind: SourceDiffRowKind;
  leftLine: number | null;
  rightLine: number | null;
  left: string | null;
  right: string | null;
}

export interface SourceFileDiff {
  path: string;
  fromCommitHash: string;
  toCommitHash: string;
  basis: string;
  fromExists: boolean;
  toExists: boolean;
  rows: SourceDiffRow[];
  truncated: boolean;
  limits: string[];
}

export function buildCommitComparison(input: CommitComparisonInput): CommitComparison {
  const fromPaths = collectFilePaths(input.fromStructure.root);
  const toPaths = collectFilePaths(input.toStructure.root);
  const fromSet = new Set(fromPaths);
  const toSet = new Set(toPaths);

  const structure: StructureDiff = {
    addedPaths: toPaths.filter((path) => !fromSet.has(path)).sort(),
    removedPaths: fromPaths.filter((path) => !toSet.has(path)).sort(),
    retainedPathCount: toPaths.filter((path) => fromSet.has(path)).length,
    basis:
      'File paths are replayed from stored Git file changes up to each selected commit. They are observed paths, not a checkout, and unchanged files outside the analysed range may be absent.',
  };

  return {
    fromCommitHash: input.fromCommit.hash,
    toCommitHash: input.toCommit.hash,
    basis:
      'Observed from stored Git commit metadata, a Git name-status diff, reconstructed structures and stored source-analysis snapshots. A missing symbol or graph element means it was absent from that stored analysis, not that it never existed.',
    from: input.fromCommit,
    to: input.toCommit,
    fileChanges: [...input.fileChanges]
      .filter((change) => change.status && change.path)
      .sort((left, right) => left.path.localeCompare(right.path)),
    structure,
    symbols:
      input.fromFiles && input.toFiles
        ? buildSymbolDiff(input.fromFiles, input.toFiles)
        : null,
    dependencies: input.dependencies ?? null,
    limits: input.limits,
  };
}

function buildSymbolDiff(
  fromFiles: ParsedSourceFileRecord[],
  toFiles: ParsedSourceFileRecord[],
): SymbolDiff {
  const from = indexSymbols(fromFiles);
  const to = indexSymbols(toFiles);
  return {
    added: [...to.entries()]
      .filter(([key]) => !from.has(key))
      .map(([, value]) => value)
      .sort(compareSymbols),
    removed: [...from.entries()]
      .filter(([key]) => !to.has(key))
      .map(([, value]) => value)
      .sort(compareSymbols),
    basis:
      'Symbols are compared by stored path, name and kind from two source-analysis snapshots. Line numbers are evidence, not identity; a moved symbol is not reported as a new symbol. Missing symbols mean absent from that analysis.',
  };
}

function indexSymbols(files: ParsedSourceFileRecord[]): Map<string, SymbolChange> {
  const result = new Map<string, SymbolChange>();
  for (const file of files) {
    for (const symbol of file.symbols) {
      const key = `${file.path}\u0000${symbol.kind}\u0000${symbol.name}`;
      if (!result.has(key)) {
        result.set(key, {
          path: file.path,
          kind: symbol.kind,
          name: symbol.name,
          line: symbol.startLine,
        });
      }
    }
  }
  return result;
}

function compareSymbols(left: SymbolChange, right: SymbolChange): number {
  return (
    left.path.localeCompare(right.path) ||
    left.name.localeCompare(right.name) ||
    left.kind.localeCompare(right.kind) ||
    left.line - right.line
  );
}

function collectFilePaths(node: StructureNode): string[] {
  const paths: string[] = [];
  const visit = (current: StructureNode): void => {
    if (current.type === 'file') paths.push(current.path);
    for (const child of current.children) visit(child);
  };
  visit(node);
  return paths.sort();
}

interface DiffOperation {
  kind: 'context' | 'removed' | 'added';
  text: string;
  leftLine: number | null;
  rightLine: number | null;
}

export function buildSourceFileDiff(input: {
  path: string;
  fromCommitHash: string;
  toCommitHash: string;
  fromContent: string | null;
  toContent: string | null;
  fromExists: boolean;
  toExists: boolean;
  maxLines: number;
}): SourceFileDiff {
  const limit = Math.max(1, input.maxLines);
  const fromLines = splitLines(input.fromContent);
  const toLines = splitLines(input.toContent);
  const truncated = fromLines.length > limit || toLines.length > limit;
  const operations = diffLines(fromLines.slice(0, limit), toLines.slice(0, limit));
  const rows = pairOperations(operations);
  const limits: string[] = [];
  if (truncated) {
    limits.push(`Only the first ${limit} lines of each file version were compared.`);
  }
  if (input.fromContent === null) {
    limits.push('The file was absent from the first commit; no source text was read.');
  }
  if (input.toContent === null) {
    limits.push('The file was absent from the second commit; no source text was read.');
  }

  return {
    path: input.path,
    fromCommitHash: input.fromCommitHash,
    toCommitHash: input.toCommitHash,
    basis:
      'Side-by-side comparison of source text read from the local Git repository at validated commits. Source text is not stored in MongoDB, and imported code is never executed.',
    fromExists: input.fromExists,
    toExists: input.toExists,
    rows,
    truncated,
    limits,
  };
}

function splitLines(content: string | null): string[] {
  if (content === null) return [];
  return content.split(/\r?\n/);
}

function diffLines(from: string[], to: string[]): DiffOperation[] {
  const width = to.length + 1;
  const table = new Int32Array((from.length + 1) * width);
  for (let i = from.length - 1; i >= 0; i -= 1) {
    for (let j = to.length - 1; j >= 0; j -= 1) {
      const index = i * width + j;
      table[index] =
        from[i] === to[j]
          ? table[(i + 1) * width + j + 1] + 1
          : Math.max(table[(i + 1) * width + j], table[index + 1]);
    }
  }

  const operations: DiffOperation[] = [];
  let i = 0;
  let j = 0;
  while (i < from.length && j < to.length) {
    if (from[i] === to[j]) {
      operations.push({
        kind: 'context',
        text: from[i],
        leftLine: i + 1,
        rightLine: j + 1,
      });
      i += 1;
      j += 1;
    } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
      operations.push({ kind: 'removed', text: from[i], leftLine: i + 1, rightLine: null });
      i += 1;
    } else {
      operations.push({ kind: 'added', text: to[j], leftLine: null, rightLine: j + 1 });
      j += 1;
    }
  }
  while (i < from.length) {
    operations.push({ kind: 'removed', text: from[i], leftLine: i + 1, rightLine: null });
    i += 1;
  }
  while (j < to.length) {
    operations.push({ kind: 'added', text: to[j], leftLine: null, rightLine: j + 1 });
    j += 1;
  }
  return operations;
}

function pairOperations(operations: DiffOperation[]): SourceDiffRow[] {
  const rows: SourceDiffRow[] = [];
  let cursor = 0;
  while (cursor < operations.length) {
    const operation = operations[cursor];
    if (operation.kind === 'context') {
      rows.push({
        kind: 'context',
        leftLine: operation.leftLine,
        rightLine: operation.rightLine,
        left: operation.text,
        right: operation.text,
      });
      cursor += 1;
      continue;
    }

    const removed: DiffOperation[] = [];
    const added: DiffOperation[] = [];
    while (cursor < operations.length && operations[cursor].kind === 'removed') {
      removed.push(operations[cursor]);
      cursor += 1;
    }
    while (cursor < operations.length && operations[cursor].kind === 'added') {
      added.push(operations[cursor]);
      cursor += 1;
    }

    const pairs = Math.min(removed.length, added.length);
    for (let index = 0; index < pairs; index += 1) {
      rows.push({
        kind: 'changed',
        leftLine: removed[index].leftLine,
        rightLine: added[index].rightLine,
        left: removed[index].text,
        right: added[index].text,
      });
    }
    for (const item of removed.slice(pairs)) {
      rows.push({
        kind: 'removed',
        leftLine: item.leftLine,
        rightLine: null,
        left: item.text,
        right: null,
      });
    }
    for (const item of added.slice(pairs)) {
      rows.push({
        kind: 'added',
        leftLine: null,
        rightLine: item.rightLine,
        left: null,
        right: item.text,
      });
    }
  }
  return rows;
}
