# Security and Legal Requirements

## Authentication and access control

- Passwords are hashed with bcryptjs; plaintext is never stored or logged.
- Access tokens are short-lived JWTs; refresh tokens are rotated and stored as hashes.
- Every project/repository query is owner-scoped and re-checked in the service layer.
- Logging out revokes the refresh token.

## Repository permissions

- Users may analyse repositories they own or public repositories subject to licence and service terms.
- Private repositories require explicit authorisation and are a later phase.
- No credentials, tokens or bypass mechanisms are used to access repositories.

## Import hardening (Phases 2 and 2b)

- HTTPS-only remote URLs; `http`, `ssh`, `git`, `file` and other schemes are rejected.
- Embedded credentials are rejected; no tokens or private-repo bypass mechanism is used.
- DNS is resolved with `all: true`; **every** returned address is checked. Loopback, private, link-local, CGNAT, IPv6 ULA, IPv4-mapped IPv6, 6to4/Teredo/NAT64, documentation, multicast, reserved and metadata-service addresses are rejected (SSRF defence).
- Up to five redirect hops are probed with `HEAD` then `GET`, and each target is validated with the same rules. Git is configured with `http.followRedirects=false`, so the clone cannot silently follow an unchecked redirect.
- `simple-git` is called with argument arrays and no shell; no string concatenation into commands. Interactive credential prompts are disabled.
- Clone operations use `CLONE_TIMEOUT_MS`. Clone directory size is walked before persistence and rejected above `MAX_CLONE_SIZE_MB`; commit extraction is capped by `MAX_COMMITS_ANALYZED`.
- All clone paths are resolved beneath `STORAGE_ROOT`; parent traversal and absolute references are rejected. Symlinks are not followed during size measurement, licence detection or cleanup.
- Failed imports remove their local clone; project deletion cascades to repository metadata, commits, jobs and storage.
- ZIP import (implemented): upload size limit, entry-count limit, per-file and total uncompressed size limits, declared-size validation, streaming write limits, path-traversal/absolute-path/backslash/reparse-point rejection, encrypted-entry and duplicate-entry rejection, and cleanup of failed or deleted snapshots.
- Never execute imported scripts, install commands, hooks or build commands. Repository files are treated as inert evidence only.
- Source analysis (Phase 4) reads Git objects at a validated commit hash or ZIP files from validated storage paths. Paths are checked for containment, commit hashes are restricted to hex object IDs, `MAX_SOURCE_FILES_ANALYZED` and `MAX_SOURCE_FILE_SIZE_MB` bound work, and raw source text is never persisted in MongoDB. Parser results are deterministic metadata only.
- AI prompts and reports (Phases 8 and 9) are bounded by `AI_MAX_EVIDENCE_ITEMS` and `REPORT_MAX_ITEMS`. AI requests time out after `AI_TIMEOUT_MS`; conversations and reports are owner-scoped, indexed by owner/project and removed with the project.
- Dependency graphs (Phase 5) are computed only from those stored parse results. All graph endpoints re-check `ownerId`, validate commit keys, and perform no further source reads, network calls or code execution. In-house Tarjan SCC replaces the non-existent `graphology-cycles` package; the UI caps displayed nodes/edges and labels truncation.
- Architecture evidence (Phase 6) is computed only from stored parse results. Architecture endpoints re-check `ownerId`, validate commit keys, and persist no interpretation. Claims are labelled with evidence and confidence; the strict anti-microservices rule prevents folders, names or imports from being presented as verified deployed topology.
- Historical comparison (Phase 7) re-checks `ownerId`, restricts commit hashes to hex object IDs and diff paths to safe forward-slash repository paths before any Git read. It uses argument arrays through `simple-git`, reads source only from the isolated local clone, applies the per-file byte cap and `MAX_DIFF_LINES`, stores no returned source text, and never executes imported code. Missing analyses, file sides or graph elements are labelled unavailable instead of inferred.

## Licensing and copyright

Detected identifiers: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, GPL-3.0, LGPL, MPL-2.0, or `No license detected`. Detection is informational, never a legal determination.

Public availability is not permission to redistribute. Copyright notices and attribution must be preserved. Phase 2 displays detected licence information in the project repository panel and labels its confidence; it is not a legal determination.

## Dependency licence inventory (verified against npm registry)

| Package | Version | Licence |
|---|---|---|
| Next.js | 16.4.6 | MIT |
| React / React DOM | 19.3.1 | MIT |
| @reduxjs/toolkit | 2.15.0 | MIT |
| react-redux | 9.3.1 | MIT |
| lucide-react | 1.77.0 | ISC |
| Tailwind CSS / @tailwindcss/postcss | 4.3.5 | MIT |
| NestJS (common, core, platform-express, testing) | 11.2.11 | MIT |
| @nestjs/config / @nestjs/jwt / @nestjs/mongoose | 4.0.4 / 11.0.2 / 11.0.4 | MIT |
| Mongoose | 9.12.3 | MIT |
| bcryptjs | 3.0.3 | BSD-3-Clause |
| Zod | 4.6.7 | MIT |
| class-validator / class-transformer | 0.15.1 / 0.5.1 | MIT |
| Helmet | 8.3.0 | MIT |
| cookie-parser | 1.4.7 | MIT |
| TypeScript (pinned to 5.9.3) | 5.9.3 | Apache-2.0 |
| Jest / ts-jest / Supertest | 29.7.0 / 29.3.0 / 7.3.2 | MIT |
| simple-git | 4.1.0 | MIT (verified against the npm registry) |
| yauzl | 3.4.0 | MIT (verified against the npm registry) |
| multer | 2.5.0 | MIT (verified against the npm registry) |
| fflate (test-only) | 0.8.3 | MIT (verified against the npm registry) |
| tree-sitter | 0.21.1 | MIT (verified against the npm registry) |
| tree-sitter-javascript | 0.23.1 | MIT (verified against the npm registry) |
| tree-sitter-typescript | 0.23.2 | MIT (verified against the npm registry) |
| tree-sitter-java | 0.23.5 | MIT (verified against the npm registry) |
| graphology | 0.26.0 | MIT (verified against the npm registry) |
| @xyflow/react | 13.0.3 | MIT (verified against the npm registry) |

Before adding any package: verify it is not already present, check compatibility, maintenance and licence, then update this table.

## Privacy and AI

- The assistant is disabled by default (`AI_ENABLED=false`) and every chat request requires explicit consent.
- Only local Ollama endpoints (`localhost`, `127.0.0.1`, `::1`) are accepted; credentials, non-loopback hosts and unsupported schemes are rejected before any request is made. No external or paid model provider is used.
- Prompts contain bounded, owner-scoped metadata and evidence strings only. Raw source text is not read into a prompt, sent, stored or executed.
- Model output must cite supplied evidence IDs. Unknown citations are ignored; uncited or malformed answers are rejected with `502` and never persisted. Answers are labelled interpretations and must not claim undocumented developer intent.
- Reports are generated from the same stored evidence boundary, are owner-scoped, and never include raw source text.
- Repository, project, conversation, report and user data deletion is supported; project deletion cascades to all derived records and isolated local storage.
