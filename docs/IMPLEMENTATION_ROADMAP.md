# Implementation Roadmap

Phases are completed one at a time. Each phase ends with a working application, passing tests and a development-log entry.

## Phase 0 — Repository inspection and planning ✅

- Inspected workspace: empty, greenfield.
- Verified Node 22.14, npm 10.9.2, Git 2.51, MongoDB 8.0 (running locally), no Redis.
- Verified package versions and licences against the npm registry.
- Created architecture, database, API, analysis, security, roadmap and log documents.

## Phase 1 — Project foundation ✅

- Backend: config validation, MongoDB, health check, global validation/errors/pagination.
- Users + auth: registration, login, logout, `me`, bcrypt, JWT access + rotating refresh cookie, guards.
- Projects: owner-scoped CRUD, DTO validation, pagination.
- Frontend: Next.js shell, Tailwind design tokens, landing/auth/dashboard/project pages, Redux + RTK Query.
- Tests: auth and project unit tests, auth and project integration tests.

**Exit:** register → login → create project → see real data on dashboard; tests and builds pass.

## Phase 2 — Git repository analysis ✅

- HTTPS-only importer with DNS/SSRF checks, redirect validation, no shell commands, hardened Git environment, clone timeout, storage-limit and commit-limit controls.
- Isolated clone storage under `STORAGE_ROOT`; no source blobs or diffs in MongoDB; failed imports and project deletion clean up local files.
- Persisted `AnalysisJob` documents with step-level progress for `import` and `reanalyze`.
- Real Git extraction of branches, tags, HEAD, commit counts, verbatim messages, authors, parents, file statuses and paths.
- Licence identification and language detection based only on observed files/changed paths.
- Owner-scoped repository status, commits, branches, tags, contributors and job APIs, with project-scoped aliases.
- Frontend import panel with job polling and history page backed entirely by stored API data.

**Exit:** import a public HTTPS repository → watch job progress → examine real commits, refs and contributors; unit/integration tests, lint, build and audit pass.

## Phase 2b — ZIP snapshot import ✅

- Safe memory-upload handling with configured archive, entry, per-file and total-size limits.
- Path traversal, unsafe paths, symlinks, encrypted entries and duplicate entries are rejected.
- Extracted files remain in isolated local storage; MongoDB stores only the file inventory.
- Snapshots explicitly report `sourceType: 'zip'`, zero commits, no branches/tags/HEAD and an inventory endpoint; the UI labels Git history as unavailable.

## Phase 3 — Timeline reconstruction ✅

- Deterministic event rules: one `commit` event per stored commit and one file-change event per observed Git status, plus a `snapshot` event for ZIP imports.
- Every event stores `confidence: 'detected'` and explicit evidence objects (kind, commit hash, path, description).
- Owner-scoped timeline list with type, contributor, date-range and pagination filters, plus event detail endpoint.
- Historical structure view reconstructed by replaying observed file changes up to a selected commit; snapshots explicitly have no Git structure.
- Timeline UI with filters, event detail/evidence panel and a structure explorer; all data comes from stored analysis results.

## Phase 4 — Source code analysis ✅

- Native Tree-sitter ABI spike succeeded on Windows/Node 22; no WASM fallback or user approval was required.
- Native JS/TS/TSX/Java parsers extract symbols, static/CommonJS/dynamic/Java imports, modules and syntax diagnostics from stored source text.
- Syntax errors are tolerated and reported; unsupported languages are explicitly labelled and receive no fabricated AST results.
- Results are cached by `(repositoryId, commitHash/key, analyzerVersion)`, refreshable on demand, owner-scoped and deleted on project deletion.
- Git source is read at an analysed commit using hardened `git show`; ZIP sources are read only from validated storage paths. File count and per-file size limits apply.

## Phase 5 — Dependency visualisation ✅

- Directed graphs built only from imports recorded by Phase 4 source analysis; relative specifiers resolve against analysed paths, Java imports match parsed packages/classes, and everything else is labelled as external or unresolved.
- In-house Tarjan SCC cycle detection over file nodes; self-loops are detected; `graphology-cycles` was not used because it does not exist on npm.
- Owner-scoped project and repository graph APIs, cycle endpoint and two-commit graph comparison with an explicit evidence-limit caveat.
- Coupling metrics (fan-in, fan-out, coupling, instability) derived from observed edges; no architectural quality scores are invented.
- React Flow explorer with cycle highlighting, bounded node/edge display, node/edge evidence inspector and comparison view.

## Phase 6 — Architecture evolution ✅

- Boundary candidates derived from observed file paths, Java packages, stored symbols and import edges; each claim carries `evidence[]` and `confidence` (`detected`, `likely`, `possible`, `unknown`).
- Observed cross-module import direction with cycle check; layer order is not claimed when imports run in both directions.
- Framework, entry-point, deployment-configuration and service-naming signals are reported as narrow observations, not architecture verdicts.
- Strict anti-microservices heuristic: no positive microservice claim from folders or names; the response withholds the claim even when all supporting signal groups are present because runtime ownership and deployed topology cannot be verified from stored source evidence.
- Owner-scoped project/repository architecture endpoints and two-analysis evolution view derived on demand from stored `analysisSnapshots`; no architecture collection and no additional source reads.
- Frontend architecture panel shows modules, confidence-labelled claims, evidence, limits and comparison results.

## Phase 7 — Historical comparison ✅

- Owner-scoped project/repository commit comparison from two analysed Git commits, combining the verbatim commit records, a validated Git `diff --name-status`, replayed structure paths, stored symbol changes and the existing stored-analysis dependency comparison.
- Side-by-side source diff for one changed path at a time, read from the isolated local Git clone at validated commits. Source text is not persisted, imported code is never executed, and per-file size/line caps and missing sides are reported explicitly.
- Unavailable symbol/dependency diffs are returned as `null` with a limit message when either commit lacks source analysis; ZIP snapshots are labelled unavailable because they have no commits.
- Frontend comparison panel on the history page with commit selection, observed change/path/symbol/dependency summaries and a colour-coded side-by-side source table.

## Phase 8 — AI assistant ✅

- Local-only Ollama adapter with `AI_ENABLED=false` default; non-loopback endpoints, credentials and unsupported schemes are rejected before any request.
- Explicit per-request consent, bounded prompt built only from owner-scoped stored metadata/evidence, no raw source text, and JSON answers that must cite supplied evidence IDs or are rejected and not stored.
- Owner-scoped conversation persistence with list/read/delete/status endpoints, evidence-ID-only citations, explicit basis/limits, and cascade deletion with the project.
- Frontend opt-in assistant panel with clear disabled state, consent checkbox, conversation history, retained citations and evidence caveats.

## Phase 9 — Reports and finalisation ✅

- Deterministic Markdown reports generated from stored, owner-scoped evidence with explicit citations, `basis`, `limits[]`, bounded evidence lines (`REPORT_MAX_ITEMS`), download/export in the UI and cascade deletion.
- Dedicated security unit coverage for bearer-token type checks, ObjectId validation and refresh-cookie flags; owner isolation covered across API integration tests.
- Evidence-based integration tests for assistant consent/disabled behaviour, citation enforcement, reports, owner isolation and cascade deletion; no browser E2E tooling was added.
- Performance pass retained bounded pagination, caps on prompt/report evidence, existing clone/source/diff limits and indexes on new owner/project collections; no synthetic benchmarks or invented performance claims.
- Final docs, environment examples and a single root `npm run verify` script; no new runtime packages were introduced.

## Deferred by explicit decision

Redis/BullMQ (in-process jobs first), meaningful-snapshot selection, private repositories, team collaboration, additional languages, browser E2E automation.
