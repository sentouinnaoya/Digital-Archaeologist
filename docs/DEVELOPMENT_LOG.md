# Development Log

> Entries are chronological snapshots of each phase, not a statement of final availability. Features marked “planned” in earlier entries may have been implemented later; the current state is recorded in entries 011–012 and in the active documentation.

## 001 — Workspace inspection and planning (Phase 0)

- Workspace `C:\Users\PC\Documents\digitalArchio` was empty: no files, no Git repository, no package manifest.
- Environment: Node v22.14.0, npm 10.9.2, Git 2.51.0.windows.1, MongoDB 8.0 service running on 127.0.0.1:27017, ~40 GB free disk. Redis not installed.
- npm registry reachable; versions and licences of candidate dependencies verified directly against the registry.
- Decisions: npm workspaces; first pass is Phase 0 + Phase 1; Redis/BullMQ deferred; ZIP import deferred to Phase 2b; AI deferred to Phase 8; no plan file written.
- Risks logged: Tree-sitter native Windows/Node 22 ABI compatibility; `graphology-cycles` absent from npm (in-house Tarjan SCC instead); free disk space requires clone size limits.

## 002 — Phase 0 foundation created

- Root `package.json` with workspace scripts, `.gitignore`, `.env.example`, `README.md`.
- Documentation: PROJECT_OVERVIEW, SYSTEM_ARCHITECTURE, DATABASE_DESIGN, API_DOCUMENTATION, ANALYSIS_ENGINE, SECURITY_AND_LEGAL, IMPLEMENTATION_ROADMAP, DEVELOPMENT_LOG.
- TypeScript pinned to 5.9.3 (registry `latest` is 7.0.2, an unvalidated major version for NestJS/Next/ts-jest).
- No application source code added yet.

## 003 — Phase 1 implementation complete

**Created**

- Backend: `config/` (Zod env validation), `database/`, `common/` (JWT guard, current-user decorator, pagination DTO, response envelope, exception filter), `modules/health`, `modules/users`, `modules/auth`, `modules/projects`, `main.ts`, `app.module.ts`.
- Backend tests: 10 unit tests (`test/unit/`) and 4 integration tests (`test/integration/`) plus separate Jest configs and a shared test-env setup file.
- Frontend: Next.js 16 App Router shell, Tailwind v4 archive design tokens, landing page, login/register pages, protected area layout, dashboard, project list/detail pages, reusable UI components, Redux store, RTK Query base API with refresh-on-401, auth and project API slices.
- Docs updated: README, API_DOCUMENTATION, SECURITY_AND_LEGAL, SYSTEM_ARCHITECTURE, IMPLEMENTATION_ROADMAP.

**Adaptations made during implementation**

- NestJS 12 is ESM-only and its CLI requires TypeScript 6 / Node ≥22.22.3. Switched to NestJS 11.2.11 (CommonJS) with TypeScript 5.9.3 and `tsc`/`ts-node` instead of the Nest CLI. No framework or language change beyond the major-version pin.
- MongoDB driver 7.8 loads its `os` adapter via dynamic `import()`, which fails in Jest's CommonJS sandbox and produced `Missing required sub-document 'driver'`. The adapter is now supplied explicitly in `DatabaseModule`, so app and tests use the same connection options.
- Jest 30 / ts-jest 29.4 pulled a duplicate Jest 30 tree with 18 moderate advisories. Pinned Jest 29.7.0 and ts-jest 29.3.0; `npm audit` now reports zero vulnerabilities for production and development dependencies.

**Verification**

- `npm run lint --workspace backend` — passed.
- `npm test` — 2 suites, 10 tests passed.
- `npm run test:e2e` — 2 suites, 4 tests passed (register/login/refresh/logout, project CRUD, cross-user access blocked, validation).
- `npm run build` — backend and frontend builds passed; Next.js produced 7 routes.
- `npm audit` — 0 vulnerabilities.

**Known limitations**

- No repository import, Git analysis, timeline, parser, graph, comparison, AI or reports yet; UI labels these as planned.
- Refresh tokens are stored in `localStorage` on the client via the Redux hydration layer. A future hardening pass should move the access token to memory only and rely on the HTTP-only refresh cookie.
- No rate limiting or email verification was added in the implemented roadmap; both remain deferred.
- Browser E2E automation is not set up; API integration tests cover the full backend workflow.

**Next phase:** Phase 2 — repository import and Git history analysis.

## 004 — Phase 2 implementation complete

**Created**

- Backend repository module: HTTPS URL validator with DNS/SSRF and redirect checks, isolated `RepositoryStorageService`, `GitService` using `simple-git`, deterministic `git log` parser, licence detector, Mongoose schemas for repositories/commits/analysis jobs, owner-scoped service/repository/controller, DTOs and module wiring.
- Persisted `AnalysisJob` documents with six recorded steps: `validate_url`, `clone`, `license`, `git_metadata`, `commits`, `persist`. Import and re-analysis return `202` and are polled through status endpoints; concurrent re-analysis is rejected while a job is queued or running.
- Real evidence extraction: branches, tags, HEAD hash, commit count, verbatim messages/bodies, author name/email, authored/committed dates, parent hashes, Git file statuses and paths. No source blobs or diffs are stored.
- Project deletion now cascades to repository metadata, commits, jobs and local clone storage.
- Tests: Git URL/SSRF utility, licence detection, log parsing, storage path safety, a real local-repository `GitService` test, repository service active-job guard, and a full repositories integration test with stubbed network/Git boundaries.
- Frontend: repository API slice, format helpers, import panel with job polling, and a project history page backed only by stored API data. The placeholder “analysis scheduled for Phase 2” panel was removed.
- Docs updated: README, API, database, security, analysis engine, architecture, roadmap and this log.

**Adaptations made during implementation**

- Added `simple-git@4.1.0` (MIT, verified against the npm registry) for Git operations. Its strict environment checks require explicitly allow-listed `GIT_CONFIG_*` variables; these are used only to disable redirect following, file protocol and credential helpers.
- `SimpleGit.revParse` is not available in this version, so `git rev-parse HEAD` is invoked through the raw argument-array API instead.
- Mongoose subdocument `_id`s were disabled for `fileChanges` and job `steps` so API responses contain only evidence fields.
- RTK Query 2.15 no longer accepts the older `refetchInterval` option in this configuration; job polling now uses an explicit timer that calls `refetch()` while a job is queued or running.
- Commit extraction passes the configured `MAX_COMMITS_ANALYZED` value through to `GitService` rather than a hardcoded `2000`, so custom limits above the default are honored.

**Verification**

- `npm run lint` — backend and frontend TypeScript checks passed.
- `npm test` — 8 suites, 43 tests passed.
- `npm run test:e2e` — 3 suites, 5 tests passed (import, status polling, history, contributors, ownership, re-analysis, deletion cascade).
- `npm run build` — backend and frontend builds passed; Next.js produced 8 routes including `/projects/[projectId]/history`.
- `npm audit` — 0 vulnerabilities.

**Known limitations**

- ZIP snapshot import remains Phase 2b; no git history is fabricated for snapshots.
- Redis/BullMQ remains deferred; jobs are persisted but execute in-process and are not restart-safe.
- A single repository per project is enforced; comparisons, timeline events, AST parsing, dependency graphs, architecture detection, AI and reports are not implemented yet.
- Browser E2E automation is still not set up; API integration tests cover the full backend workflow and production build covers the UI route.

**Next phase:** Phase 2b (ZIP snapshot import), then Phase 3 timeline reconstruction, subject to the agreed phased order.

## 005 — Phase 2b implementation complete

**Created**

- `ZipImportService` using `yauzl` with memory uploads via `multer`, strict safe-path checks, symlink/reparse-point rejection, encrypted-entry rejection, duplicate detection, declared-size checks, streaming per-file limits and total uncompressed-size limits.
- `snapshotFiles` schema and repository methods for replacing/listing/counting observed files; repository documents now distinguish `git_url` from `zip` and store `snapshotName`, `snapshotFileCount` and `snapshotTotalBytes`.
- Job steps for snapshots: `validate_archive`, `extract`, `inventory`, `persist`. Re-analysis reuses the validated local files; a failed import removes its storage.
- APIs: `POST /projects/:projectId/snapshots/import`, `GET /repositories/projects/:projectId/files`, `GET /repositories/:repositoryId/files`. Project deletion cascades to snapshot metadata and storage.
- Frontend: Git/snapshot import choice, file picker, observed-file inventory, explicit “Git history unavailable” messaging, and snapshot-aware repository summary.
- Tests: ZIP safe extraction/traversal/size/entry unit tests and a full snapshot integration test covering ownership, zero fabricated commits, file inventory and deletion cascade.
- Docs updated: README, API, database, security, analysis engine, project overview, roadmap and this log.

**Adaptations made during implementation**

- Added `yauzl@3.4.0` and `multer@2.5.0` as runtime dependencies, plus `@types/yauzl`, `@types/multer` and test-only `fflate@0.8.3`; all licences were verified against the npm registry. `npm audit` still reports zero vulnerabilities.
- `yauzl` rejects unsafe relative paths before application validation; its error text is normalised to the same safe “ZIP contains an unsafe path” message so tests and API clients see one clear category.
- Snapshot ZIP ordering is not stable, so inventory tests sort paths explicitly.

**Verification**

- `npm run lint` — backend and frontend TypeScript checks passed.
- `npm test` — 9 suites, 47 tests passed.
- `npm run test:e2e` — 4 suites, 7 tests passed.
- `npm run build` — backend and frontend builds passed; Next.js produced 8 routes.
- `npm audit` — 0 vulnerabilities.

**Known limitations**

- Snapshots have no commit history, branches, tags or contributor data by design.
- Archive contents are treated as inert evidence; no scripts or build commands are executed.
- Redis/BullMQ remains deferred; snapshot jobs also run in-process.

**Next phase:** Phase 3 — timeline reconstruction.

## 006 — Phase 3 implementation complete

**Created**

- `timeline` module with `timelineEvents` schema, owner-scoped repository layer and deterministic `TimelineEventBuilder`. Git imports produce one `commit` event per stored commit plus one event per observed file status; ZIP imports produce a single `snapshot` event.
- Every event records `confidence: 'detected'` and explicit evidence objects referencing commit hashes and file paths. No dates, intent or contributors are inferred.
- APIs: filtered/paginated project timeline, event detail, and project/repository structure reconstruction. Filters cover event type, contributor name/email, ISO date range and pagination.
- `StructureBuilder` replays observed Git file changes up to a selected commit, returns a nested directory tree, states the reconstruction basis and rejects unknown commits/snapshots.
- Repositories service rebuilds timeline events on import/re-analysis and deletes them on project deletion.
- Frontend: `TimelinePanel` with filters, event detail/evidence view, and `StructurePanel` with a commit selector and tree; history page now handles Git and ZIP sources explicitly.
- Tests: builder unit tests, structure replay unit tests and a full timeline integration test covering filters, evidence, structure, ownership and deletion cascade.
- Docs updated: README, API, database, analysis engine, architecture, roadmap and this log.

**Adaptations made during implementation**

- Timeline events are rebuilt deterministically from stored commits rather than written incrementally, so re-analysis cannot leave stale or duplicated evidence.
- `ReconstructedStructure` is explicitly labelled as a replay of analysed file changes; files never changed in the analysed range may be absent. ZIP snapshots return a clear `400` instead of an empty fake tree.
- Query contributor strings are regex-escaped and date ranges are validated before reaching MongoDB.

**Verification**

- `npm run lint` — backend and frontend TypeScript checks passed.
- `npm test` — 11 suites, 52 tests passed.
- `npm run test:e2e` — 5 suites, 8 tests passed.
- `npm run build` — backend and frontend builds passed; Next.js produced 8 routes.
- `npm audit` — 0 vulnerabilities.

**Known limitations**

- Reconstructed structure reflects only the analysed commit range and Git's observed statuses; it is not a checkout and does not contain file contents.
- Timeline events are derived from Git/archive facts only; higher-level architecture claims remain Phase 6.
- Redis/BullMQ remains deferred; jobs still run in-process.

**Next phase:** Phase 4 — source code analysis.

## 007 — Phase 4 implementation complete

**Native ABI spike**

- `tree-sitter@0.25.1` loaded on Windows x64 / Node 22.14 (ABI 127), but its JavaScript grammar expected a newer peer and Java/TypeScript grammars pinned older `tree-sitter` versions.
- Downgraded to `tree-sitter@0.21.1` with `tree-sitter-javascript@0.23.1`, `tree-sitter-typescript@0.23.2` and `tree-sitter-java@0.23.5`. All four packages are MIT-licensed (verified against the npm registry) and successfully parsed JavaScript, TypeScript and Java sample code through the native bindings.
- No WASM fallback was used, so no change to the approved stack was needed.

**Created**

- `code-analysis` module with an `analysisSnapshots` schema, owner-scoped repository/service/controller and a deterministic `parseSourceFile` infrastructure function.
- Native parsers extract named symbols, static/CommonJS/dynamic imports, Java imports and package namespaces, plus syntax-error diagnostics with line/column positions. Unsupported languages return an explicit `unsupported` status with no invented symbols.
- Hardened `GitService.listFilesAtCommit` and `readFileAtCommit` use argument arrays, validated hex commit hashes and safe repository paths. ZIP sources are read only from containment-checked storage paths.
- Caching by `(repositoryId, commitHash, analyzerVersion)` with explicit `refresh`, plus owner-scoped latest-analysis APIs and deletion on project deletion.
- Config limits `MAX_SOURCE_FILES_ANALYZED` and `MAX_SOURCE_FILE_SIZE_MB`; `fileLimitApplied` is reported in results.
- Frontend `SourceAnalysisPanel` on the project detail page: runs analysis explicitly, shows cached status, summaries, per-file diagnostics/symbols/imports, and labels unsupported or syntax-error files honestly.
- Tests: parser unit tests and a source-analysis integration test covering Git text parsing, ZIP-style unsupported language handling, caching, ownership and deletion.
- Docs updated: README, API, database, analysis engine, architecture, security, roadmap and this log.

**Adaptations made during implementation**

- Grammar versions were pinned to the `tree-sitter@0.21.x` peer range rather than accepting npm peer-dependency warnings; this keeps one native runtime and avoids ABI mismatches.
- Git file reads cap bytes after decoding, and file reads that fail are recorded with an empty content placeholder rather than crashing the whole analysis; their status still reflects the actual parse result of the content provided.
- Analysis is explicit rather than automatic during import so users can choose a commit and understand which evidence is being parsed.

**Verification**

- `npm run lint` — backend and frontend TypeScript checks passed.
- `npm test` — 12 suites, 57 tests passed.
- `npm run test:e2e` — 6 suites, 9 tests passed.
- `npm run build` — backend and frontend builds passed; Next.js produced 8 routes.
- `npm audit --audit-level=moderate` — 0 vulnerabilities.

**Known limitations**

- Snapshot selection for meaningful commits remains deferred; Git analysis currently parses the supplied/HEAD commit.
- Supported AST grammars are JavaScript, TypeScript/TSX and Java only. Other languages are explicitly labelled unsupported.
- Dependency edges are extracted as raw imports/modules in Phase 4; graph metrics and cycle detection belong to Phase 5.
- Redis/BullMQ remains deferred; jobs still run in-process.

**Next phase:** Phase 5 — dependency visualisation.

## 008 — Phase 5 implementation complete

**Created**

- `dependency-analysis` backend module with a deterministic `graphology` builder, in-house Tarjan SCC cycle detection, fan-in/fan-out/coupling/instability metrics and a two-commit comparison response.
- Owner-scoped project/repository graph APIs, cycle endpoint and comparison endpoint, all derived from stored `analysisSnapshots` with validated commit keys and explicit 404/400 behaviour.
- Frontend `dependencyApi`, graph types and `DependencyGraphPanel`: React Flow explorer with cycle highlighting, bounded node/edge display, node/edge evidence inspector, cycle list and comparison view on the project detail page.
- Unit coverage for relative/index/Java resolution, cycles, self-loops and comparison semantics; integration coverage for graph APIs, ownership, validation and deletion cascades.

**Adaptations made during implementation**

- `graphology@0.26.0` (MIT) and `@xyflow/react@13.0.3` (MIT) were checked against the npm registry before installation and added to the licence inventory.
- No graph collection was added: graphs are recomputed from stored parse results, so there is no second persisted representation to keep in sync.
- Jest's per-file module registry could not safely reload native Tree-sitter bindings when two separate integration suites parsed source in one worker. All parser-backed flows were grouped into a single `analysis.e2e-spec.ts`; graph construction itself remains unit-tested. No WASM fallback or approval was needed.
- Debug instrumentation used during the native-loader investigation was removed; parse failures remain explicit `parse_failed` results with the underlying message.

**Verification**

- `npm run lint` — backend and frontend TypeScript checks passed.
- `npm test` — 13 suites, 61 tests passed.
- `npm run test:e2e` — 6 suites, 10 tests passed.
- `npm run build` — backend and frontend builds passed; Next.js produced 8 routes.
- `npm audit --audit-level=moderate` — 0 vulnerabilities.

**Known limitations**

- Cycles are detected among `file` nodes only; package and unresolved nodes are endpoints, not traversal targets.
- The React Flow view caps displayed nodes/edges by coupling and cycle membership; truncation is labelled in the UI.
- Historical comparison compares two stored analyses, not arbitrary historical commits; a missing graph element means it was absent from that analysis.
- At this point, architecture detection, historical file/symbol diffs, AI and reports were still planned; all four were implemented in later phases. Redis/BullMQ remains deferred.

**Next phase:** Phase 6 — architecture evolution.

## 009 — Phase 6 implementation complete

**Created**

- `architecture-analysis` backend module with deterministic boundary/direction derivation, framework/entry-point/deployment/service/naming signals, evidence-bearing claims, confidence levels and two-analysis evolution comparison.
- Owner-scoped project/repository architecture endpoints and project evolution endpoint, all derived on demand from stored `analysisSnapshots` with validated commit keys and explicit 404/400 behaviour.
- Frontend `architectureApi` and `ArchitecturePanel`: module cards, confidence-labelled claim list with evidence inspector, observed import direction, analysis limits and a comparison view on the project detail page.
- Unit coverage for module/claim derivation, strict microservice withholding, analysis limits and comparison semantics; integration coverage for architecture APIs, ownership, validation and deletion cascade.

**Adaptations made during implementation**

- No architecture collection was added; claims are recomputed from the same parse results as dependency graphs, so interpretations cannot become a second source of truth.
- The microservice claim is withheld even when separate entry-point candidates, deployment paths, service-boundary candidates and network imports are present; stored source evidence cannot verify deployed topology.
- `GraphSourceFile` gained an optional `truncated` field so architecture limits can report per-file parser truncation without changing dependency graph semantics.
- The parser-backed integration flows remain consolidated in `analysis.e2e-spec.ts`; no WASM fallback or approval was needed.

**Verification**

- `npm run lint` — backend and frontend TypeScript checks passed.
- `npm test` — 14 suites, 65 tests passed.
- `npm run test:e2e` — 6 suites, 11 tests passed.
- `npm run build` — backend and frontend builds passed; Next.js produced 8 routes.
- `npm audit --audit-level=moderate` — 0 vulnerabilities.

**Known limitations**

- Boundary and direction claims are candidates from stored paths and imports, not declared architecture or named layers.
- Entry-point, deployment-configuration and service-naming signals are narrow observations; they do not establish runtime ownership or deployed topology.
- Evolution compares two stored analyses, not arbitrary historical commits; a missing element means it was absent from that analysis.
- At this point, historical file/symbol diffs, AI and reports were still planned; diffs were implemented in Phase 7 and AI/reports in Phases 8–9. Redis/BullMQ remains deferred.

**Next phase:** Phase 7 — historical comparison.

## 010 — Phase 7 implementation complete

**Created**

- `historical-comparison` backend module with a deterministic comparison builder and owner-scoped project/repository endpoints for two-commit commit, Git file-change, replayed-structure, stored-symbol and dependency-graph comparisons.
- Validated `git diff --name-status --no-renames` support in `GitService`, exact commit lookup by hash, and bounded side-by-side source diffs read from the isolated local clone without storing source text in MongoDB.
- `comparisonApi`, shared comparison types and `HistoricalComparisonPanel` on the repository history page: commit selection, observed change/path/symbol/dependency summaries, explicit unavailable labels and a colour-coded side-by-side source table.
- `MAX_DIFF_LINES` environment limit with a default of 2000 lines, plus explicit limits for truncated files, missing sides and large file-change lists.
- Unit coverage for comparison assembly, symbol matching and diff row pairing; parser-backed integration coverage for project/repository comparison APIs, side-by-side diffs, ownership, path/hash validation and deletion cascade.

**Adaptations made during implementation**

- No comparison or diff collection was added. Git changes are replayed from stored commits plus a live name-status diff, symbol/dependency sections reuse stored `analysisSnapshots`, and source text is read on demand and returned only in the HTTP response.
- ZIP imports return `400` for comparison because they have no commit history; missing analyses return `null` sections with a limit message instead of inferred results.
- The native-parser unit flake recurred when suite ordering changed: `projects.service.spec.ts` imported `ProjectsService`, which loaded `CodeAnalysisService` and the parser bindings before `source-parser.spec.ts`. That unrelated suite now mocks `CodeAnalysisService`, leaving the parser spec as the only unit suite that loads native bindings. Five consecutive backend unit runs passed after the fix.
- At this point, the frontend planned-instruments navigation listed only AI and reports; both were implemented in later phases, and the navigation now exposes only implemented instruments.

**Verification**

- `npm run lint` — backend and frontend TypeScript checks passed.
- `npm test` — 15 suites, 69 tests passed.
- `npm run test:e2e` — 6 suites, 12 tests passed.
- `npm run build` — backend and frontend builds passed; Next.js produced 8 routes.
- `npm audit --audit-level=moderate` — 0 vulnerabilities.

**Known limitations**

- Comparison requires source analysis to have been run explicitly at both commits before symbol and dependency diffs are available.
- Replayed structure paths are observed file changes in the analysed range, not a checkout; unchanged files outside that range may be absent.
- Side-by-side source comparison is capped by `MAX_DIFF_LINES` and the per-file source byte limit; truncation is reported rather than silently omitted.
- Snapshot selection for meaningful commits remains deferred. AI and reports, still planned at this point, were later implemented in entries 011–012. Redis/BullMQ remains deferred.

**Next phase at the time:** Phase 8 — AI assistant (post-MVP), subsequently completed in entry 011.

## 011 — Phase 8 implementation complete

**Created**

- Shared `evidence` module that collects owner-scoped project, repository, timeline, source-analysis, dependency and architecture records through existing services.
- `ai-assistant` backend module with a disabled-by-default local Ollama adapter, deterministic evidence-prompt builder, JSON response parser, owner-scoped conversation schema/repository and chat/status/list/read/delete endpoints.
- Explicit per-request consent, local-only endpoint enforcement (`localhost`, `127.0.0.1`, `::1`), request timeout, bounded evidence items, and rejection of malformed or uncited model answers without persistence.
- Frontend AI panel with a clear unavailable state, consent checkbox, conversation history, retained citations, basis/limits and destructive action guard.
- Unit coverage for prompt bounding, no-source-text guarantees, citation parsing, local-endpoint rejection and security primitives; parser-backed integration coverage for disabled behaviour, consent, citations, ownership, conversation append and deletion.

**Adaptations made during implementation**

- No external model provider or new runtime dependency was added. Node's built-in fetch is used against a loopback Ollama endpoint only.
- The shared evidence collector avoids duplicating owner checks and reuses stored analysis output; raw source text is never read into a prompt and imported code is never executed.
- The persisted conversation field was named `modelName` to avoid colliding with Mongoose's document `model` API.
- AI conversations are included in the project deletion cascade.

**Verification**

- Backend and frontend TypeScript checks, backend unit tests, backend integration tests and both production builds passed; final merged results are recorded in entry 012.

**Known limitations**

- A local Ollama binary and model must be installed separately; the application does not download or fake model availability.
- Answers are only as complete as stored analyses; unavailable graph or architecture evidence is labelled, never inferred.
- Snapshot selection and analysis pipeline workers remain deferred.

**Next phase:** Phase 9 — reports and finalisation.

## 012 — Phase 9 implementation and final verification

**Created**

- `reports` backend module with a deterministic Markdown builder, owner-scoped report schema/repository and generate/list/read/delete endpoints, plus project deletion cascade for reports and AI conversations.
- Frontend report panel with generation, stored report selection, citation/basis display, `.md` download and deletion.
- Dedicated security unit coverage for access-token type enforcement, ObjectId validation and refresh-cookie flags; integration coverage for report generation, owner isolation, deletion and cascade cleanup.
- Root `npm run audit` and `npm run verify` scripts, final API/database/security/architecture/roadmap/README updates, and `.env.example` entries for AI and report limits.
- Updated navigation so only genuinely implemented instruments remain; no synthetic benchmarks or invented performance figures were added.

**Adaptations made during implementation**

- Reports reuse the Phase 8 evidence collector instead of introducing a second representation of derived facts.
- Evidence lines are capped by `REPORT_MAX_ITEMS` and omissions are reported explicitly; unavailable sections remain labelled unavailable.
- The performance pass retained bounded pagination, existing clone/source/diff caps, new owner/project indexes and the time-bounded AI adapter; Redis/BullMQ and browser E2E automation were deliberately left deferred.
- A final stale-wording sweep corrected historical log annotations and UI labels so only genuinely deferred work is described as unavailable or planned.

**Verification**

- `npm run verify` passed end to end.
- `npm run lint` — backend and frontend TypeScript checks passed.
- `npm test` — 20 suites, 88 tests passed.
- `npm run test:e2e` — 6 suites, 14 tests passed.
- `npm run build` — backend and frontend builds passed; Next.js produced 8 routes.
- `npm run audit` — 0 vulnerabilities.

**Known limitations / deferred work**

- The assistant remains opt-in and local-only; no external or paid model provider is supported.
- Reports describe currently stored evidence and are not a historical reconstruction of every commit.
- Meaningful snapshot selection, private repositories, team collaboration, additional languages, Redis/BullMQ workers and browser E2E automation are deferred by explicit decision.

**Next phase:** none — the documented roadmap is complete; future work is tracked as deferred items.

