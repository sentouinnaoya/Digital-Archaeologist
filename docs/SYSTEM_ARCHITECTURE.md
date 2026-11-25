# System Architecture

## Repository layout

The project is an npm workspace monorepo:

```
digitalArchio/
├── package.json          # workspace scripts
├── backend/              # NestJS API
├── frontend/             # Next.js App Router UI
└── docs/                 # this documentation
```

## High-level components

```
Browser
  │  HTTPS / REST JSON
  ▼
Next.js (App Router, Server + Client Components)
  │  RTK Query → REST
  ▼
NestJS REST API  (/api/v1)
  ├─ Auth / Users / Projects
  ├─ Repositories + Git history extraction            [Phase 2]
  ├─ Code Analysis + Dependency Graph              [Phases 4-5]
  ├─ Timeline [Phase 3]; Architecture Evidence      [Phase 6]
  ├─ Historical comparison [Phase 7]                [implemented]
  ├─ Local-only AI assistant [Phase 8]              [implemented]
  ├─ Evidence reports [Phase 9]                     [implemented]
  └─ Analysis pipeline workers                      [planned]
  ▼
MongoDB (metadata, results, jobs) + local repository storage
```

## Backend layering

Each module separates concerns:

- **Controller** — HTTP only: DTO validation, auth guard, status codes.
- **Service** — business rules, ownership enforcement, orchestration.
- **Repository** — Mongoose queries and data mapping.
- **DTO / Schema** — boundary validation and persistence shape.
- **Infrastructure** — Git, filesystem, parsers, graph algorithms, AI providers (kept independent of HTTP).

NestJS dependency injection wires the layers. Controllers stay thin. Cross-cutting concerns (validation, response envelope, error mapping) live in `common/`.

## Current modules (Phases 1, 2, 2b, 3, 4, 5, 6, 7, 8 and 9)

| Module | Responsibility |
|---|---|
| `health` | Liveness plus MongoDB connectivity check |
| `users` | User persistence and lookup |
| `auth` | Registration, login, logout, current user, JWT access + rotating refresh token |
| `projects` | Project CRUD with owner-scoped access; cascades repository data on delete |
| `repositories` | URL/SSRF validation, isolated clone storage, Git metadata and commit extraction, safe ZIP snapshot inventory, persisted jobs, status/history APIs |
| `timeline` | Deterministic evidence events, filtered timeline/event-detail APIs, reconstructed historical structure |
| `code-analysis` | Native Tree-sitter parsing, symbol/import/module extraction, syntax diagnostics, cached analysis snapshots |
| `dependency-analysis` | Owner-scoped graphs, Tarjan cycles, coupling metrics and two-commit comparison derived from stored parse results |
| `architecture-analysis` | Owner-scoped boundary/direction/claim snapshots and evolution derived from stored parse results, with confidence levels and strict anti-microservices rules |
| `evidence` | Shared owner-scoped collector for project, repository, timeline, analysis, dependency and architecture evidence |
| `historical-comparison` | Owner-scoped two-commit comparison of observed Git changes, replayed structures, stored symbols/graphs and bounded side-by-side source text |
| `ai-assistant` | Disabled-by-default local Ollama adapter, bounded evidence prompts, citation enforcement and owner-scoped conversations |
| `reports` | Deterministic Markdown report generation from stored evidence, with citations, limits and owner-scoped persistence |

The Phase 2 module contains a thin controller, an owner-scoped service, a Mongoose repository layer, and infrastructure utilities for URL validation, storage paths, licence detection, Git access and deterministic log parsing. `ProjectsModule` imports `RepositoriesModule` for deletion cascading.

## Planned modules

`git-analysis` (later stages) and `workers`.

## Analysis pipeline (design contract)

Each stage has a defined input/output, records status, handles errors independently and is retryable:

```
import → validate → git metadata → commits → snapshot selection
       → AST parse → dependencies → architecture evidence
       → timeline → persist → visualise
```

The engine caches by `(repositoryId, commitHash, analyzerVersion)` and selects meaningful snapshots instead of fully parsing every file in every historical commit.

## State management

- Server state (API data) is owned by RTK Query caches, with tag-based invalidation.
- Client state (session/UI) is owned by Redux Toolkit slices.
- Server Components render static content (landing page, metadata); Client Components are used only where interaction is required.

## Build tooling

The backend is compiled with `tsc` and run with `ts-node` rather than the Nest CLI. NestJS 12 is ESM-only and its CLI currently requires TypeScript 6 plus a newer Node patch level than the installed Node 22.14, so the last CommonJS-compatible NestJS 11 line is used with TypeScript 5.9.3. Frontend builds use the standard Next.js toolchain.

## Runtime decisions

- Job execution starts in-process with a persisted `AnalysisJob` document. Redis/BullMQ is introduced only if concurrency or restart-safe queuing becomes a real requirement.
- Tree-sitter native bindings were validated in the Phase 4 spike on Windows/Node 22 (ABI 127) with `tree-sitter@0.21.1` and pinned MIT-licensed grammars. Native parsing is used; no WASM fallback or approval request was needed.
- Source analysis is explicit and bounded by file count/per-file size limits. Raw source is read from isolated storage or Git objects, never from untrusted network locations at analysis time, and imported code is never executed.
- No cycle-detection package is used: `graphology-cycles` does not exist on the npm registry. Cycle detection is implemented in-house with Tarjan SCC over `graphology` directed graphs.
- Dependency graphs are computed on demand from owner-scoped `analysisSnapshots`. The React Flow explorer bounds displayed nodes/edges, highlights cycles and shows the stored import evidence behind every visible relationship; no graph is persisted as a new source of truth.
- Architecture evidence is also derived on demand from those snapshots. Claims carry evidence and confidence levels; the microservice claim is withheld even when all supporting signal groups are present. No architecture collection or interpretation store is persisted.
- Historical comparison combines stored commits/structures/analyses with bounded `git diff` and `git show` reads from the isolated local clone. Diff paths and commit hashes are validated, source text is returned only in the response, and unavailable analysis-based sections are labelled unavailable.
- The AI and report surfaces share one evidence collector. Prompts and reports contain stored metadata, paths and evidence strings only; raw source text remains in isolated local storage and is never sent to a model or copied into a report.
