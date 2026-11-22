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
| `sourceType` | string | Currently `git_url`; ZIP snapshots deferred to Phase 2b |
| `repositoryUrl` | string | Validated HTTPS URL; metadata only |
| `defaultBranch` | string | Default `main` |
| `localStorageReference` | string | Relative path under `STORAGE_ROOT`, e.g. `<projectId>/<repositoryId>` |
| `status` | string | `importing`, `ready` or `failed` |
| `license` | object? | `{ identifier, confidence, path }`, or `null` |
| `branches` | string[] | Ref names observed in the clone |
| `tags` | string[] | Tag names observed in the clone |
| `headCommitHash` | string? | Full 40-character Git hash |
| `totalCommitCount` | number | Real commit count from `git rev-list --count HEAD` |
| `analyzedCommitCount` | number | Number of commits persisted, capped by `MAX_COMMITS_ANALYZED` |
| `detectedLanguages` | string[] | Derived from observed changed-file extensions, top five |
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

## Planned collections

### analysisSnapshots
`repositoryId`, `commitHash`, `fileStructure`, `detectedLanguages`, `detectedModules`, `architectureEvidence`, `dependencyGraph`, `analyzerVersion`, `analyzedAt`. Cache key: `(repositoryId, commitHash, analyzerVersion)`.

### timelineEvents
`projectId`, `repositoryId`, `commitHash`, `eventType`, `title`, `description`, `evidence[]`, `confidence`, `occurredAt`. Index on `(projectId, occurredAt: -1)`.

### aiconversations
`userId`, `projectId`, `messages[]`, timestamps.

## Rules

- Every query on user-owned data is scoped by `ownerId`; ownership is re-checked in the service layer.
- Source code is not stored in MongoDB except small, deliberately selected evidence excerpts with commit and path references.
- Deleting a project must cascade to its repository metadata, analysis results and local storage directory.
- Test suites use a separate database (`MONGO_TEST_URI`) and clean up after themselves.
