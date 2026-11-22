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

## Phase 2b — ZIP snapshot import

Safe extraction limits, no fabricated Git history, clearly labelled snapshot-only analysis.

## Phase 3 — Timeline reconstruction

Evidence-based event rules, confidence, date/contributor/type filters, event detail and historical structure view.

## Phase 4 — Source code analysis

Tree-sitter native spike (WASM fallback needs approval), JS/TS/Java parsers, symbols/imports/modules, syntax-error tolerance, unsupported-language fallback, result caching.

## Phase 5 — Dependency visualisation

Graphology graphs, in-house Tarjan cycle detection, coupling metrics, React Flow explorer, historical graph comparison.

## Phase 6 — Architecture evolution

Evidence rules, confidence levels, snapshots, evolution view, strict anti-microservices heuristic.

## Phase 7 — Historical comparison

Commit selection, file/structure/symbol/dependency diffs, side-by-side code diff.

## Phase 8 — AI assistant (post-MVP)

Ollama adapter, disabled by default, evidence-grounded answers, conversation persistence.

## Phase 9 — Reports and finalisation

Reports/export, full security suite, integration and E2E tests, performance pass, final docs.

## Deferred by explicit decision

Redis/BullMQ (in-process jobs first), ZIP import (Phase 2b), AI (Phase 8), private repositories, team collaboration, additional languages.
