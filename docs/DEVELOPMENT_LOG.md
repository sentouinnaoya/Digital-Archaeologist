# Development Log

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
- No rate limiting or email verification yet; planned for Phase 9 hardening.
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

