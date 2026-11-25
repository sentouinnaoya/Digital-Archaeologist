# API Documentation

Base path: `/api/v1`. All request and response bodies are JSON.

## Conventions

- Validation failures return `400` with a `message` array from `class-validator`.
- Unauthenticated requests return `401`; accessing another user's resource returns `404` (no existence leak) or `403` where explicitly noted.
- Successful responses use `{ "data": ... }`; paginated responses use `{ "data": [...], "meta": { "page", "limit", "total", "totalPages" } }`.
- Errors use `{ "statusCode", "message", "error", "path", "timestamp" }`.
- Resource IDs are MongoDB ObjectId strings; invalid IDs return `400`.

## Implemented (Phases 1, 2, 2b, 3, 4, 5, 6, 7, 8 and 9)

### Health
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/health` | No | Liveness and MongoDB ping |

### Authentication
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | No | `{ fullName, email, password }` → user + access token |
| POST | `/auth/login` | No | `{ email, password }` → user + access token |
| POST | `/auth/refresh` | Refresh cookie | Rotates the refresh cookie and returns a new access token |
| POST | `/auth/logout` | Refresh cookie | Revokes the current refresh token |
| GET | `/auth/me` | Bearer | Current user profile |

Passwords: minimum 8 characters, at least one letter and one number. Access tokens are short-lived JWTs in the `Authorization: Bearer …` header. Refresh tokens are rotated and stored only as hashes, in an HTTP-only cookie.

### Projects
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/projects` | Bearer | `{ name, description?, repositoryUrl?, defaultBranch?, primaryLanguage? }` |
| GET | `/projects?page=1&limit=20` | Bearer | Owner's projects, paginated |
| GET | `/projects/:projectId` | Bearer | Single owned project |
| PATCH | `/projects/:projectId` | Bearer | Partial update of editable fields |
| DELETE | `/projects/:projectId` | Bearer | Delete owned project. Also cascades repository metadata, commits, jobs and local clone storage. |

### Repositories and Git history (Phase 2)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/repositories/import` | Bearer | Start an HTTPS Git import for a project; returns repository + initial job |
| POST | `/projects/:projectId/snapshots/import` | Bearer | Multipart `file` upload; start a ZIP snapshot inventory job |
| GET | `/repositories/projects/:projectId/status` | Bearer | Project-scoped repository and latest job status, or empty values before import |
| GET | `/repositories/projects/:projectId/commits?page=1&limit=20` | Bearer | Stored commits for the project's repository, newest first |
| GET | `/repositories/projects/:projectId/branches` | Bearer | Observed branch names |
| GET | `/repositories/projects/:projectId/tags` | Bearer | Observed tag names |
| GET | `/repositories/projects/:projectId/contributors` | Bearer | Contributors derived from stored commits |
| GET | `/repositories/projects/:projectId/files` | Bearer | Observed files for a ZIP snapshot |
| GET | `/repositories/:repositoryId` | Bearer | Single owned repository |
| GET | `/repositories/:repositoryId/status` | Bearer | Repository and latest job status |
| POST | `/repositories/:repositoryId/analyze` | Bearer | Queue a re-analysis using the existing local clone |
| GET | `/repositories/:repositoryId/commits?page=1&limit=20` | Bearer | Paginated stored commits |
| GET | `/repositories/:repositoryId/branches` | Bearer | Observed branch names |
| GET | `/repositories/:repositoryId/tags` | Bearer | Observed tag names |
| GET | `/repositories/:repositoryId/contributors` | Bearer | Contributors derived from stored commits |
| GET | `/repositories/:repositoryId/files` | Bearer | Observed files for a ZIP snapshot |
| GET | `/repositories/:repositoryId/jobs` | Bearer | Most recent 20 analysis jobs |

### Timeline (Phase 3)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/projects/:projectId/timeline?type=&from=&to=&contributor=&page=1&limit=20` | Bearer | Paginated, filtered evidence events |
| GET | `/projects/:projectId/timeline/:eventId` | Bearer | Single owned event with full evidence |
| GET | `/projects/:projectId/structure?at=<commitHash>` | Bearer | Structure reconstructed up to an analysed commit |
| GET | `/repositories/:repositoryId/structure?at=<commitHash>` | Bearer | Repository-scoped structure reconstruction |

`TimelineEventView` contains `id`, `type` (`commit`, `file_added`, `file_modified`, `file_deleted`, `file_renamed`, `snapshot`), `occurredAt`, `title`, `description`, `confidence` (`detected` for observed Git/archive facts), `commitHash`, contributor fields, `paths` and `evidence[]`. Filtering by `contributor` matches stored names or emails; `from`/`to` are ISO dates. `from` after `to` returns `400`.

`ReconstructedStructure` contains `repositoryId`, `atCommitHash`, `analyzedCommitCount`, `fileCount`, `confidence`, `basis` and a nested tree of observed files/directories. It is a replay of Git file changes in the analysed range, not a checkout; files never changed in that range may be absent. ZIP snapshots return `400` because they have no Git commits.

### Source analysis (Phase 4)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/code-analysis/repositories/:repositoryId/analyze` | Bearer | Parse source at a commit (Git) or stored snapshot files (ZIP); optional `{ "commitHash", "refresh" }` body |
| GET | `/code-analysis/repositories/:repositoryId/latest` | Bearer | Most recent owned analysis snapshot for a repository |
| GET | `/code-analysis/projects/:projectId/latest` | Bearer | Most recent owned analysis snapshot for a project |

`SourceAnalysis` contains `id`, `repositoryId`, `projectId`, `sourceType`, `commitHash` (`snapshot` for ZIP), `analyzerVersion`, `cached`, `summary` and `files[]`. Each file records `path`, `language`, `parser`, `status` (`parsed`, `syntax_error`, `unsupported`, `parse_failed`), `size`, `symbols[]`, `imports[]`, `modules[]`, `syntaxErrors[]` and `truncated`. The summary reports parsed/syntax-error/unsupported/failed counts plus symbol and import counts. Parsing is explicit; importing a repository does not automatically run it. `MAX_SOURCE_FILES_ANALYZED` and `MAX_SOURCE_FILE_SIZE_MB` cap work, and `fileLimitApplied` is reported when the file cap is reached.

`POST /repositories/import` body:

```json
{
  "projectId": "66f0f1c2a8b45e1234567890",
  "repositoryUrl": "https://github.com/example/repository.git",
  "defaultBranch": "main"
}
```

- `repositoryUrl` must be a valid HTTPS URL without embedded credentials. DNS is resolved and checked against private, loopback, link-local, metadata-service and other reserved ranges; up to five redirect hops are validated with the same rules.
- `defaultBranch` is optional, defaults to `main`, and is restricted to a safe character set.
- Returns `202` with `{ "data": { "repository": RepositoryView, "job": JobView } }`.
- Returns `400` for invalid input, `404` when the project does not belong to the caller, and `409` when the project already has a repository.

`RepositoryView` contains `id`, `projectId`, `sourceType` (`git_url` | `zip`), `repositoryUrl`, `snapshotName`, `defaultBranch`, `status` (`importing` | `ready` | `failed`), licence detection, `branches`, `tags`, `headCommitHash`, `totalCommitCount`, `analyzedCommitCount`, `detectedLanguages`, `snapshotFileCount`, `snapshotTotalBytes`, timestamps, and `lastError`.

`POST /projects/:projectId/snapshots/import` accepts one `.zip` file as multipart field `file` and returns the same `202` envelope. ZIP snapshots record only an observed file inventory: `totalCommitCount`, `analyzedCommitCount`, `headCommitHash`, `branches` and `tags` remain empty/zero, and commit/contributor endpoints return empty results. The file endpoints return `{ path, size, extension, language }` entries sorted by path.

`JobView` contains `id`, `repositoryId`, `projectId`, `type` (`import` | `reanalyze`), `status` (`queued` | `running` | `completed` | `failed`), `progress`, `currentStep`, `error`, per-step state, and timestamps. Long-running operations return `202 Accepted`; clients poll the status endpoint until the job is no longer queued/running. `POST /repositories/:repositoryId/analyze` returns `409` if a job is already queued or running, or if the initial import is still in progress.

`CommitView` contains the verbatim `message`, full `hash`, author name/email, authored/committed timestamps, `parentHashes`, and observed `fileChanges` with Git status codes and paths. `ContributorView` is aggregated from stored commits and includes commit count plus first/last authored dates.

### Dependency graph (Phase 5)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/projects/:projectId/dependencies?commitHash=` | Bearer | Graph from stored source analysis; omit `commitHash` for the latest analysis |
| GET | `/projects/:projectId/dependencies/cycles?commitHash=` | Bearer | Detected cycles for the same analysis point |
| GET | `/projects/:projectId/dependencies/compare?from=&to=` | Bearer | Difference between two stored analysis graphs |
| GET | `/repositories/:repositoryId/dependencies?commitHash=` | Bearer | Repository-scoped graph from the same stored analysis |

All four endpoints are owner-scoped and return `404` when there is no stored source analysis for the requested scope/commit. `commitHash` accepts a hex Git object hash or `snapshot`; invalid values return `400`. Graphs are computed on demand from `analysisSnapshots`; no new graph collection and no additional source reads are involved.

`DependencyGraph` contains `repositoryId`, `projectId`, `commitHash`, `analyzerVersion`, `sourceType`, `basis`, `nodes[]`, `edges[]`, `cycles[]` and `metrics`. Nodes have `id`, `kind` (`file`, `package`, `unresolved`), `label`, `path`, `language`, `parser`, `status` and `metrics`. Edges have `id`, `source`, `target`, `kind` (`relative`, `package`, `java`, `unresolved`) and `evidence[]` entries of `{ path, line, importSource, detail }`. Cycles list their file node ids, contributing edge ids and evidence. `metrics` reports observed node/edge counts, cycle count, average coupling and maximum fan-in/fan-out. `basis` states that values are graph counts, not architectural quality claims.

`GraphComparison` contains `fromCommitHash`, `toCommitHash`, `basis`, added/removed nodes and edges, and `couplingChanges`. Its `basis` explicitly says that a missing node or edge means it was absent from that stored analysis, not that the file or import did not exist historically.

### Architecture evidence (Phase 6)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/projects/:projectId/architecture?commitHash=` | Bearer | Architecture evidence from stored source analysis; omit `commitHash` for the latest analysis |
| GET | `/projects/:projectId/architecture/history?from=&to=` | Bearer | Difference between two stored architecture analyses |
| GET | `/repositories/:repositoryId/architecture?commitHash=` | Bearer | Repository-scoped architecture evidence from the same stored analysis |

All three endpoints are owner-scoped and return `404` when there is no stored source analysis for the requested scope/commit. `commitHash`, `from` and `to` accept a hex Git object hash or `snapshot`; invalid values return `400`. Architecture evidence is computed on demand from `analysisSnapshots`; no architecture collection is persisted and no additional source reads occur.

`ArchitectureSnapshot` contains `repositoryId`, `projectId`, `commitHash`, `analyzerVersion`, `sourceType`, `basis`, `modules[]`, `directionality`, `claims[]`, `metrics` and `limits[]`. Modules have `id`, `name`, `kind` (`directory` or `java_package`), `filePaths`, `fileCount`, `symbolCount`, `internalEdgeCount`, `externalEdgeCount`, `imports`, `importedBy` and `confidence`. `directionality` reports observed source/sink module ids, cross-module edge count, whether those edges form a cycle, and its own confidence. Claims have `id`, `type`, `title`, `statement`, `confidence`, `rule` and `evidence[]`; evidence entries are `{ kind, path, line, detail }` with `kind` one of `file`, `import`, `symbol`, `structure`. `metrics` reports module/edge/claim counts by confidence plus framework, entry-point, deployment-config, service-naming and network-package signal counts. `limits` reports applied analysis caps, truncated parse results and ZIP history absence. `basis` states that boundary/direction/naming claims are candidates and no architecture style or deployed topology is inferred.

Claim types are `module_boundary`, `layering`, `framework_usage`, `entry_point_candidate`, `deployment_config`, `service_naming` and `microservice_inference`. The `microservice_inference` claim is always withheld as a positive architecture claim; even when separate entry points, deployment paths, service-boundary candidates and network imports are all observed, its statement says no microservice architecture is claimed and its confidence is at most `possible`.

`ArchitectureEvolution` contains `fromCommitHash`, `toCommitHash`, `basis`, added/removed modules, added/removed claims and `confidenceChanges[]` with `{ id, before, after }`. Its `basis` says a missing module or claim means it was absent from that stored analysis, not that it did not exist historically.

### Historical comparison (Phase 7)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/projects/:projectId/compare?from=&to=` | Bearer | Compare two analysed Git commits for a project |
| GET | `/projects/:projectId/compare/files?from=&to=&path=` | Bearer | Side-by-side source diff for one changed path |
| GET | `/repositories/:repositoryId/compare?fromCommit=&toCommit=` | Bearer | Repository-scoped commit comparison |
| GET | `/repositories/:repositoryId/compare/files?fromCommit=&toCommit=&path=` | Bearer | Repository-scoped side-by-side source diff |

All four endpoints are owner-scoped. `from`, `to`, `fromCommit` and `toCommit` accept 4–40 character hexadecimal Git object hashes; invalid hashes return `400`, and either commit missing from the analysed history returns `404`. `path` must be a safe forward-slash repository path; traversal, absolute, backslash, drive-letter and NUL inputs return `400`. ZIP snapshots have no commits and return `400`; unavailable symbol or dependency comparisons are reported as `null` plus an explicit entry in `limits[]`, never filled with invented results.

`CommitComparison` contains `fromCommitHash`, `toCommitHash`, `basis`, the two verbatim `ComparisonCommit` records, `fileChanges[]`, `structure`, `symbols`, `dependencies` and `limits[]`. `fileChanges[]` comes from `git diff --name-status --no-renames`. `structure` reports added/removed paths and retained path count from the two reconstructed structures. Symbols are matched by stored path, name and kind from both `analysisSnapshots`; `dependencies` reuses the stored-analysis `GraphComparison`. The response basis states that a missing symbol or graph element means it was absent from that analysis, not that it never existed.

`SourceFileDiff` contains `path`, both commit hashes, `basis`, `fromExists`, `toExists`, `rows[]`, `truncated` and `limits[]`. Each row has `kind` (`context`, `added`, `removed`, `changed`), optional left/right line numbers and optional left/right text. Source text is read from the local Git clone at the validated commits with the same per-file byte cap as source analysis; it is not persisted in MongoDB. Comparison is bounded by `MAX_DIFF_LINES` (default 2000) and reports truncation explicitly. File changes are bounded by 500 displayed entries, also with an explicit limit message.

### AI assistant (Phase 8)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/projects/:projectId/ai/status` | Bearer | Reports enabled state, configured model and evidence caveats |
| GET | `/projects/:projectId/ai/conversations` | Bearer | List the project's persisted conversations |
| GET | `/ai/conversations/:conversationId` | Bearer | Read one owner-scoped conversation with messages |
| POST | `/projects/:projectId/ai/chat` | Bearer | Send a question with explicit consent and receive a cited answer |
| DELETE | `/ai/conversations/:conversationId` | Bearer | Delete one owner-scoped conversation |

The assistant is disabled by default (`AI_ENABLED=false`). While disabled, `GET .../status` returns `enabled: false` and `POST .../chat` returns `503`; no model request is made. The adapter accepts **local-only** `OLLAMA_BASE_URL` values (`localhost`, `127.0.0.1`, `::1`); credentials and non-loopback hosts are rejected before any request. Modelled after Ollama's generate API, the request uses argument-free JSON with `stream: false`, JSON response format and temperature 0.

`POST .../ai/chat` accepts `{ message (1–2000 chars), conversationId? (ObjectId), consent: true }`. Missing or false consent returns `400`. The prompt is built from bounded, owner-scoped stored metadata: project record, repository status, recent timeline events, parsed file/symbol/import records, architecture claims and dependency cycles/hubs. Raw source text is never read into the prompt, sent, stored or executed. The response must be JSON with `answer` and non-empty `evidenceIds`; citations outside the supplied set are ignored, and a response with no valid citations is rejected with `502` and not stored. Persisted messages keep only the answer text and validated evidence IDs. `AI_MAX_EVIDENCE_ITEMS` (default 20) caps prompt items and any omission is reported in `limits[]`.

Every answer carries `basis`, `limits[]`, `evidence[]` and `model`. The basis states that model output is an interpretation, not a verified fact, and that commit messages are not proof of intent.

### Reports (Phase 9)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/projects/:projectId/reports` | Bearer | Generate and persist a Markdown report from current stored evidence |
| GET | `/projects/:projectId/reports` | Bearer | List persisted reports (`page`, `limit`) |
| GET | `/reports/:reportId` | Bearer | Read one owner-scoped report with content and citations |
| DELETE | `/reports/:reportId` | Bearer | Delete one owner-scoped report |

A report contains `title`, `format: "markdown"`, `content`, `basis`, `evidenceIds[]`, `limits[]` and `createdAt`. It is generated deterministically from the same owner-scoped evidence bundle used by the assistant; it never quotes source text, never executes imported code, and labels missing analysis/graph/architecture sections unavailable. `REPORT_MAX_ITEMS` (default 20) bounds cited evidence lines and reports omissions explicitly. Reports and AI conversations are deleted when their project is deleted.

## Planned endpoints

```
GET    /repositories/:repositoryId/snapshots
```

No planned endpoint is considered implemented until it is wired to real analysis output.
