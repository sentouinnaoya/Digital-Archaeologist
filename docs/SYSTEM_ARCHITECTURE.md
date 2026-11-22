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
  ├─ Code Analysis, Dependencies, Architecture,
   │  Comparison, Timeline                       [planned]
  ├─ AI Assistant, Reports                            [planned]
  └─ Analysis pipeline workers                        [planned]
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

## Current modules (Phases 1 and 2)

| Module | Responsibility |
|---|---|
| `health` | Liveness plus MongoDB connectivity check |
| `users` | User persistence and lookup |
| `auth` | Registration, login, logout, current user, JWT access + rotating refresh token |
| `projects` | Project CRUD with owner-scoped access; cascades repository data on delete |
| `repositories` | URL/SSRF validation, isolated clone storage, Git metadata and commit extraction, persisted jobs, status/history APIs |

The Phase 2 module contains a thin controller, an owner-scoped service, a Mongoose repository layer, and infrastructure utilities for URL validation, storage paths, licence detection, Git access and deterministic log parsing. `ProjectsModule` imports `RepositoriesModule` for deletion cascading.

## Planned modules

`git-analysis` (later stages), `code-analysis`, `dependency-analysis`, `architecture-analysis`, `historical-comparison`, `timeline`, `ai-assistant`, `reports`, `workers`.

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
- Tree-sitter native bindings are the intended parser. A Windows/Node 22 ABI spike happens at the start of Phase 4; if it fails, `web-tree-sitter` (WASM, MIT) is proposed as an explicit alternative before any stack change.
- No cycle-detection package is used: `graphology-cycles` does not exist on the npm registry. Cycle detection is implemented in-house with Tarjan SCC.
