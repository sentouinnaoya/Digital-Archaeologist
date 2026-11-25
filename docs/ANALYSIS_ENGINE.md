# Analysis Engine

## Design goals

The analysis engine reconstructs history from evidence, stays incremental, and never invents facts. Git operations, parsers and graph algorithms are independent of HTTP controllers.

## Pipeline stages

1. **Repository import** — HTTPS URL clone (Phase 2, implemented) or safe ZIP snapshot file inventory (Phase 2b, implemented).
2. **Validation** — URL/SSRF checks, size and path limits, licence detection (Phase 2, implemented).
3. **Git metadata extraction** — branches, tags, refs (Phase 2, implemented).
4. **Commit history processing** — hashes, messages, authors, timestamps, parents, changed files (Phase 2, implemented).
5. **Snapshot selection** — choose meaningful commits by structural change, not every commit (planned).
6. **Source parsing** — native Tree-sitter ASTs for JS/TS/TSX/Java; file-level fallback for other languages (Phase 4, implemented).
7. **Dependency extraction** — graph edges from observed imports, Tarjan cycles, coupling (Phase 5, implemented).
8. **Architecture evidence detection** — confidence-labelled boundaries, import direction and narrow signals (Phase 6, implemented).
9. **Timeline reconstruction** — evidence-linked chronological events (Phase 3, implemented).
10. **Persistence and visualisation** — snapshots, graphs, events exposed through REST.
11. **Historical comparison** — two-commit Git/path/symbol/graph and bounded side-by-side source diffs (Phase 7, implemented).

## Stage contract

Each stage declares input, output, status, error behaviour and retry policy. A failed stage must not erase results from earlier stages. Stage execution is recorded on the `AnalysisJob` document.

Phase 2 records these steps in order: `validate_url`, `clone`, `license`, `git_metadata`, `commits`, `persist`. Each step stores `pending`, `running`, `completed` or `failed` state with timestamps and an error where applicable. Jobs run in-process but are persisted; a re-analysis reuses the validated local clone and replaces stored commits only after successful extraction.

## Incremental strategy

- Git metadata is extracted for all commits (cheap).
- Full AST parsing is reserved for selected snapshots.
- Results are cached by `(repositoryId, commitHash, analyzerVersion)`.
- Unchanged file parse results are reused when safe.

## Evidence model

```ts
interface Evidence {
  kind: 'commit' | 'file' | 'symbol' | 'import' | 'structure';
  commitHash?: string;
  path?: string;
  detail: string;
}

type Confidence = 'detected' | 'likely' | 'possible' | 'unknown';
```

Every timeline event and architecture claim carries `evidence[]` and `confidence`. Git provides observed facts; detection rules produce deterministic changes; AI produces interpretations that must use the same evidence objects and may not add new facts.

## Architecture detection constraints

- A new folder alone is not a module migration. Phase 6 reports a `module_boundary` candidate only from directory/Java-package membership plus stored symbols and import edges; internal and cross-boundary counts are evidence, not proof of a declared module.
- Directionality comes from cross-module import edges. If those edges form a cycle, no layer order is claimed; otherwise source/sink module ids are reported with a confidence level.
- Microservices are never inferred from folders, `Service` suffixes, imports or framework names. Even when separate entry-point candidates, deployment-configuration paths, service-boundary candidates and network imports are all observed, the `microservice_inference` claim is withheld because runtime ownership and deployed topology cannot be verified from stored source evidence.
- Framework, entry-point and deployment-configuration claims describe the narrow observed signal only, not a broader architectural role.
- When evidence is insufficient, emit `confidence: 'unknown'` rather than a guess. Every claim carries `evidence[]` and a `rule` string, and analysis caps are surfaced in `limits[]`.

## Language support

Initial native parsers: JavaScript, TypeScript/TSX and Java. The Windows/Node 22 ABI spike succeeded with `tree-sitter@0.21.1`, `tree-sitter-javascript@0.23.1`, `tree-sitter-typescript@0.23.2` and `tree-sitter-java@0.23.5`; no WASM fallback was used. Unsupported languages get basic file-level analysis (path, size, detected language) and are explicitly reported as unsupported — never parsed with regexes pretending to be an AST. Syntax errors are reported with line/column data and the parser's recovered nodes are kept.

Source analysis reads Git blobs at a validated commit through `git show`, or ZIP snapshot files from their validated storage paths. It caps the number of files and per-file bytes, caches by `(repositoryId, commitHash, analyzerVersion)`, and never executes imported code.

## Dependency graph rules (Phase 5)

Graphs are derived on demand from stored parse results; they are not a second source of truth and are not persisted. Each observed import becomes at most one directed edge per source/target/kind, with every occurrence retained as evidence `{ path, line, importSource, detail }`.

- Relative specifiers (`.`/`..`) resolve against analysed file paths with extension and `index` fallbacks. Ambiguous or missing targets become explicit `unresolved` nodes.
- Java imports match parsed package/class names where possible; otherwise they become `package` nodes. External JS/TS specifiers always become `package` nodes.
- `file` nodes are the only nodes considered for cycles. Tarjan SCC reports multi-node components and self-loops, with the contributing edge ids and evidence.
- `fanIn`, `fanOut`, `coupling` and `instability` are counts/ratios over observed edges. They are not architecture scores.
- Historical comparison uses two stored analyses. Missing nodes/edges mean "absent from that analysis", not "did not exist historically"; the response says so in its `basis`.
- The React Flow explorer bounds display to the highest-coupling nodes and all cycle nodes, and labels any truncation. Clicking a node or edge shows the source imports behind it.

## Architecture evidence rules (Phase 6)

Architecture snapshots are derived on demand from the same stored parse results as dependency graphs; no second interpretation is persisted. Directory and Java-package membership group analysed files into boundary candidates. Internal and cross-boundary edge counts, symbols and file paths become evidence. Package imports provide narrow framework/network signals; filename conventions provide entry-point candidates; known path patterns provide deployment-configuration signals; symbol suffixes provide service-naming signals.

Every claim is labelled `detected`, `likely`, `possible` or `unknown`. `detected` is used only for directly stored paths, symbols and import specifiers; higher-level boundary, direction and naming claims are `likely`, `possible` or `unknown`. The anti-microservices claim is always withheld as a positive architecture verdict. Evolution compares two stored analyses and explicitly says that a missing element means it was absent from that analysis, not that it never existed historically.

## Historical comparison rules (Phase 7)

Comparison is assembled from committed evidence only: verbatim stored commit records, a `git diff --name-status --no-renames` between validated commits, path sets replayed from stored file changes, symbol sets from the two `analysisSnapshots`, and the stored-analysis dependency comparison. File paths and commit hashes are validated before any Git read; side-by-side source text is read from the local clone with the source-analysis per-file byte cap and a separate `MAX_DIFF_LINES` cap, then returned directly without persistence or execution.

A missing symbol, edge, file side or analysis snapshot is labelled unavailable rather than inferred. Replayed paths are not a checkout, and a stored-analysis comparison does not prove historical existence; both caveats appear in the response `basis` and `limits[]`. ZIP snapshots have no Git commits, so the comparison endpoints return `400` instead of fabricating history.

## AI and report evidence rules (Phases 8 and 9)

The shared evidence collector reads only owner-scoped stored records: project metadata, repository status, recent timeline events, `analysisSnapshots` metadata, dependency graphs and architecture claims. AI prompts and Markdown reports are bounded by `AI_MAX_EVIDENCE_ITEMS` and `REPORT_MAX_ITEMS`; omitted items are reported, not silently dropped. Raw source text is never part of a prompt or report, and imported code is never executed.

The assistant is disabled by default and accepts only a local Ollama endpoint. Every request needs explicit consent. Model output is accepted only as JSON with a non-empty answer and evidence IDs that exist in the supplied prompt; unknown citations are ignored and uncited answers are rejected without persistence. Answers are labelled interpretations, never verified facts or proof of developer intent. Reports are deterministic, cite the stored evidence they used and label unavailable sections explicitly.

## Status

**Phases 2, 2b, 3, 4, 5, 6, 7, 8 and 9 implemented:** validated HTTPS import, safe ZIP snapshot inventory, isolated storage, licence detection, Git metadata extraction, full commit/file-change persistence, deterministic evidence events, filtered timeline/event-detail APIs, reconstructed historical structure, native AST parsing with cached symbol/import/module results, owner-scoped status/history/source-analysis APIs, evidence-backed dependency graphs with cycles/coupling/comparison, confidence-labelled architecture evidence with a strict anti-microservices heuristic, two-commit evidence comparison with bounded side-by-side source text, opt-in evidence-grounded AI conversations, deterministic Markdown reports, persisted job steps, and UI surfaces for all implemented instruments.

**Not implemented yet:** meaningful snapshot selection and analysis pipeline workers. These remain contracts for later work and are not presented as available features.
