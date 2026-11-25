# Database Design

MongoDB with Mongoose. Metadata and analysis results are stored here; repository working copies live in controlled local storage under `STORAGE_ROOT`, never as blobs in MongoDB.

## Implemented in Phase 1

### users

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `fullName` | string | Required, trimmed |
| `email` | string | Required, lowercase, **unique index** |
| `passwordHash` | string | bcrypt hash; never a plaintext password |
| `refreshTokenHash` | string? | Hash of the currently valid refresh token |
| `createdAt`, `updatedAt` | Date | Timestamps |

### projects

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `ownerId` | ObjectId → users | Required, indexed |
| `name` | string | Required, trimmed |
| `description` | string | Default `''` |
| `repositoryUrl` | string? | Optional project metadata; the validated import URL is stored on `repositories` |
| `defaultBranch` | string | Default `main` |
| `primaryLanguage` | string? | Set from the first detected language after a successful Phase 2 analysis |
| `analysisStatus` | string | `not_started`, `queued`, `completed` or `failed` after Phase 2 import/analysis |
| `lastAnalyzedAt` | Date? | |
| `createdAt`, `updatedAt` | Date | Timestamps |

Indexes: `{ ownerId: 1, name: 1 }` unique, `{ ownerId: 1, createdAt: -1 }`.

## Implemented in Phase 2

### repositories

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `projectId` | ObjectId → projects | Required, **unique index**, indexed |
| `ownerId` | ObjectId → users | Required, indexed |
| `sourceType` | string | `git_url` or `zip` |
| `repositoryUrl` | string? | Validated HTTPS URL for Git imports; `null` for snapshots |
| `snapshotName` | string? | Sanitised uploaded filename for snapshots; `null` for Git imports |
| `defaultBranch` | string | Default `main` |
| `localStorageReference` | string | Relative path under `STORAGE_ROOT`, e.g. `<projectId>/<repositoryId>` |
| `status` | string | `importing`, `ready` or `failed` |
| `license` | object? | `{ identifier, confidence, path }`, or `null` |
| `branches` | string[] | Ref names observed in the clone |
| `tags` | string[] | Tag names observed in the clone |
| `headCommitHash` | string? | Full 40-character Git hash |
| `totalCommitCount` | number | Real commit count from `git rev-list --count HEAD` |
| `analyzedCommitCount` | number | Number of commits persisted, capped by `MAX_COMMITS_ANALYZED` |
| `detectedLanguages` | string[] | Derived from observed file/changed-file extensions, top five |
| `snapshotFileCount` | number | Number of observed files for ZIP snapshots; `0` for Git imports |
| `snapshotTotalBytes` | number | Sum of observed snapshot file sizes; `0` for Git imports |
| `lastImportedAt`, `lastAnalyzedAt` | Date? | Set on successful import/analysis |
| `lastError` | string? | Most recent failure message |
| `createdAt`, `updatedAt` | Date | Timestamps |

Indexes: unique `projectId`, plus `{ ownerId: 1, createdAt: -1 }`.

### commits

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `repositoryId` | ObjectId → repositories | Required, indexed |
| `ownerId` | ObjectId → users | Required, indexed |
| `hash` | string | Full Git commit hash, unique per repository |
| `message` | string | Verbatim, including body |
| `authorName`, `authorEmail` | string | From the commit object |
| `authoredAt`, `committedAt` | Date | ISO timestamps from the commit object |
| `parentHashes` | string[] | Full parent hashes |
| `fileChanges` | array | `{ status, path }` from `git log --name-status --no-renames` |
| `createdAt`, `updatedAt` | Date | Timestamps |

Indexes: unique `{ repositoryId: 1, hash: 1 }` and `{ repositoryId: 1, committedAt: -1 }`. File contents, source blobs and diffs are not stored.

### snapshotFiles (Phase 2b)

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `repositoryId` | ObjectId → repositories | Required, indexed; unique with `path` |
| `ownerId` | ObjectId → users | Required, indexed |
| `path` | string | Safe forward-slash path from the ZIP archive |
| `size` | number | Extracted byte size |
| `extension` | string? | Lower-case extension, or `null` |
| `language` | string? | Detected from the extension, or `null` |
| `createdAt`, `updatedAt` | Date | Timestamps |

Indexes: unique `{ repositoryId: 1, path: 1 }` and `{ repositoryId: 1, language: 1 }`. Only metadata is stored in MongoDB; extracted file contents stay under `STORAGE_ROOT`.

### analysisJobs

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `repositoryId` | ObjectId → repositories | Required, indexed |
| `projectId`, `ownerId` | ObjectId | Required, indexed |
| `type` | string | `import` or `reanalyze` |
| `status` | string | `queued`, `running`, `completed` or `failed` |
| `progress` | number | 0–100 |
| `currentStep` | string | Human-readable current step |
| `error` | string? | Failure message |
| `steps` | array | `name`, `status`, `startedAt`, `completedAt`, `error`; subdocument `_id` disabled |
| `startedAt`, `completedAt` | Date? | Timestamps |
| `createdAt`, `updatedAt` | Date | Timestamps |

Index: `{ repositoryId: 1, createdAt: -1 }`. Jobs execute in-process but are persisted so status survives an HTTP request cycle.

### timelineEvents (Phase 3)

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `repositoryId` | ObjectId → repositories | Required, indexed |
| `projectId`, `ownerId` | ObjectId | Required, indexed |
| `type` | string | `commit`, `file_added`, `file_modified`, `file_deleted`, `file_renamed` or `snapshot` |
| `occurredAt` | Date | Commit timestamp or snapshot import time |
| `title`, `description` | string | Deterministic summary of observed evidence |
| `confidence` | string | `detected`, `likely`, `possible` or `unknown`; Git/archive events use `detected` |
| `commitHash` | string? | Full hash for Git events; `null` for snapshots |
| `contributorEmail`, `contributorName` | string? | From the commit object |
| `paths` | string[] | Observed file paths |
| `evidence` | array | `{ kind, commitHash, path, detail }`; subdocument `_id` disabled |
| `createdAt`, `updatedAt` | Date | Timestamps |

Indexes: `{ repositoryId: 1, occurredAt: -1 }`, `{ projectId: 1, ownerId: 1, occurredAt: -1 }`, `{ projectId: 1, ownerId: 1, type: 1, occurredAt: -1 }`. Events are deterministically rebuilt after import/re-analysis and removed on project deletion.

### analysisSnapshots (Phase 4)

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `repositoryId`, `projectId`, `ownerId` | ObjectId | Required, indexed |
| `sourceType` | string | `git_url` or `zip` |
| `commitHash` | string | Full Git hash, or `snapshot` for ZIP imports |
| `analyzerVersion` | string | Cache key component |
| `files` | array | Parsed file records: path, language, parser, status, size, symbols, imports, modules, syntaxErrors, truncated; nested `_id`s disabled |
| `summary` | object | File/status counts, symbol/import totals and `fileLimitApplied` |
| `createdAt`, `updatedAt` | Date | Timestamps |

Unique index: `{ repositoryId: 1, commitHash: 1, analyzerVersion: 1 }`. Also indexed by `{ ownerId: 1, projectId: 1, createdAt: -1 }`. Raw source text is not stored in MongoDB; only deterministic parse results are persisted. Cache entries are removed on project deletion.

Phase 5 dependency graphs, Phase 6 architecture evidence and Phase 7 symbol/dependency comparison are **not** separate collections. They are computed on demand from the `files[].path`, `files[].symbols`, `files[].imports` and `files[].modules` records above, so no second representation can drift from the source analysis. Graph, architecture, evolution and historical-comparison endpoints read one or two existing `analysisSnapshots` documents for the same owner/project. Phase 7 Git file changes and side-by-side source text are also not persisted: the former are replayed from `commits[].fileChanges` and a live Git name-status diff, while the latter is read from the isolated clone and returned only in the response.

### aiConversations (Phase 8)

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `ownerId`, `projectId` | ObjectId | Required, indexed |
| `title` | string | First 60 characters of the opening question |
| `modelName` | string | Configured Ollama model at creation time |
| `basis` | string | Evidence/interpretation caveat for the conversation |
| `messages` | array | `_id: false`; `role`, `content`, `evidenceIds[]`, `createdAt` |
| `createdAt`, `updatedAt` | Date | Timestamps |

Indexed by `{ ownerId: 1, projectId: 1, updatedAt: -1 }`. Only validated evidence IDs are stored; raw prompts are kept as user message text, but source code is never persisted.

### reports (Phase 9)

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `ownerId`, `projectId` | ObjectId | Required, indexed |
| `title`, `format`, `content`, `basis` | string | `format` is `markdown`; content is deterministic derived text |
| `evidenceIds`, `limits` | string[] | Cited stored evidence IDs and explicit limitation messages |
| `createdAt`, `updatedAt` | Date | Timestamps |

Indexed by `{ ownerId: 1, projectId: 1, createdAt: -1 }`. Reports contain no raw source text. Both collections are removed on project deletion.

## Rules

- Every query on user-owned data is scoped by `ownerId`; ownership is re-checked in the service layer.
- Source code is not stored in MongoDB. Parsed metadata, evidence strings and Git paths/hashes are stored; raw file text and diffs are returned on demand from isolated local storage.
- Deleting a project must cascade to its repository metadata, analysis results, AI conversations, reports and local storage directory.
- Test suites use a separate database (`MONGO_TEST_URI`) and clean up after themselves.
