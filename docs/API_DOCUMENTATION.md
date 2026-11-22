# API Documentation

Base path: `/api/v1`. All request and response bodies are JSON.

## Conventions

- Validation failures return `400` with a `message` array from `class-validator`.
- Unauthenticated requests return `401`; accessing another user's resource returns `404` (no existence leak) or `403` where explicitly noted.
- Successful responses use `{ "data": ... }`; paginated responses use `{ "data": [...], "meta": { "page", "limit", "total", "totalPages" } }`.
- Errors use `{ "statusCode", "message", "error", "path", "timestamp" }`.
- Resource IDs are MongoDB ObjectId strings; invalid IDs return `400`.

## Implemented (Phases 1 and 2)

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
| GET | `/repositories/projects/:projectId/status` | Bearer | Project-scoped repository and latest job status, or empty values before import |
| GET | `/repositories/projects/:projectId/commits?page=1&limit=20` | Bearer | Stored commits for the project's repository, newest first |
| GET | `/repositories/projects/:projectId/branches` | Bearer | Observed branch names |
| GET | `/repositories/projects/:projectId/tags` | Bearer | Observed tag names |
| GET | `/repositories/projects/:projectId/contributors` | Bearer | Contributors derived from stored commits |
| GET | `/repositories/:repositoryId` | Bearer | Single owned repository |
| GET | `/repositories/:repositoryId/status` | Bearer | Repository and latest job status |
| POST | `/repositories/:repositoryId/analyze` | Bearer | Queue a re-analysis using the existing local clone |
| GET | `/repositories/:repositoryId/commits?page=1&limit=20` | Bearer | Paginated stored commits |
| GET | `/repositories/:repositoryId/branches` | Bearer | Observed branch names |
| GET | `/repositories/:repositoryId/tags` | Bearer | Observed tag names |
| GET | `/repositories/:repositoryId/contributors` | Bearer | Contributors derived from stored commits |
| GET | `/repositories/:repositoryId/jobs` | Bearer | Most recent 20 analysis jobs |

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

`RepositoryView` contains `id`, `projectId`, `sourceType`, `repositoryUrl`, `defaultBranch`, `status` (`importing` | `ready` | `failed`), licence detection, `branches`, `tags`, `headCommitHash`, `totalCommitCount`, `analyzedCommitCount`, `detectedLanguages`, timestamps, and `lastError`.

`JobView` contains `id`, `repositoryId`, `projectId`, `type` (`import` | `reanalyze`), `status` (`queued` | `running` | `completed` | `failed`), `progress`, `currentStep`, `error`, per-step state, and timestamps. Long-running operations return `202 Accepted`; clients poll the status endpoint until the job is no longer queued/running. `POST /repositories/:repositoryId/analyze` returns `409` if a job is already queued or running, or if the initial import is still in progress.

`CommitView` contains the verbatim `message`, full `hash`, author name/email, authored/committed timestamps, `parentHashes`, and observed `fileChanges` with Git status codes and paths. `ContributorView` is aggregated from stored commits and includes commit count plus first/last authored dates.

## Planned endpoints

```
GET    /projects/:projectId/timeline[/:eventId]
GET    /repositories/:repositoryId/structure
GET    /repositories/:repositoryId/snapshots
GET    /repositories/:repositoryId/symbols
GET    /repositories/:repositoryId/architecture[/history]
GET    /repositories/:repositoryId/dependencies[/cycles]
GET    /repositories/:repositoryId/compare?fromCommit=&toCommit=
POST   /projects/:projectId/ai/chat
GET    /projects/:projectId/ai/conversations
GET    /ai/conversations/:conversationId
POST   /projects/:projectId/reports
GET    /projects/:projectId/reports
```

No planned endpoint is considered implemented until it is wired to real analysis output.
