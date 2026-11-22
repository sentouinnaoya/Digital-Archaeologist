# Analysis Engine

## Design goals

The analysis engine reconstructs history from evidence, stays incremental, and never invents facts. Git operations, parsers and graph algorithms are independent of HTTP controllers.

## Pipeline stages

1. **Repository import** — HTTPS URL clone (Phase 2, implemented) or ZIP snapshot (Phase 2b).
2. **Validation** — URL/SSRF checks, size and path limits, licence detection (Phase 2, implemented).
3. **Git metadata extraction** — branches, tags, refs (Phase 2, implemented).
4. **Commit history processing** — hashes, messages, authors, timestamps, parents, changed files (Phase 2, implemented).
5. **Snapshot selection** — choose meaningful commits by structural change, not every commit (Phase 4).
6. **Source parsing** — Tree-sitter ASTs for JS/TS/Java; file-level fallback for other languages.
7. **Dependency extraction** — imports, module edges, cycles, coupling.
8. **Architecture evidence detection** — module boundaries, layering, DI, service separations.
9. **Timeline reconstruction** — evidence-linked chronological events.
10. **Persistence and visualisation** — snapshots, graphs, events exposed through REST.

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

- A new folder alone is not a module migration; look for classes, imports and ownership of behaviour.
- Microservices are never inferred from multiple folders or classes named `Service`. Supporting evidence requires separate entry points, deployment configuration, service boundaries and network communication.
- When evidence is insufficient, emit `confidence: 'unknown'` rather than a guess.

## Language support

Initial parsers: JavaScript, TypeScript, Java. Unsupported languages get basic file-level analysis (path, size, language guess) and are explicitly reported as unsupported — never parsed with regexes pretending to be an AST.

## Status

**Phase 2 implemented:** validated HTTPS import, isolated storage, licence detection, Git metadata extraction, full commit/file-change persistence, owner-scoped status/history APIs, persisted job steps, and UI surfaces for import and history.

**Not implemented yet:** snapshot selection, AST parsing, dependency extraction, architecture detection, timeline reconstruction, comparison, AI and reports. These remain contracts for later phases and are not presented as available features.
