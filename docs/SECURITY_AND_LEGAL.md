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

## Import hardening (Phase 2; ZIP import in Phase 2b)

- HTTPS-only remote URLs; `http`, `ssh`, `git`, `file` and other schemes are rejected.
- Embedded credentials are rejected; no tokens or private-repo bypass mechanism is used.
- DNS is resolved with `all: true`; **every** returned address is checked. Loopback, private, link-local, CGNAT, IPv6 ULA, IPv4-mapped IPv6, 6to4/Teredo/NAT64, documentation, multicast, reserved and metadata-service addresses are rejected (SSRF defence).
- Up to five redirect hops are probed with `HEAD` then `GET`, and each target is validated with the same rules. Git is configured with `http.followRedirects=false`, so the clone cannot silently follow an unchecked redirect.
- `simple-git` is called with argument arrays and no shell; no string concatenation into commands. Interactive credential prompts are disabled.
- Clone operations use `CLONE_TIMEOUT_MS`. Clone directory size is walked before persistence and rejected above `MAX_CLONE_SIZE_MB`; commit extraction is capped by `MAX_COMMITS_ANALYZED`.
- All clone paths are resolved beneath `STORAGE_ROOT`; parent traversal and absolute references are rejected. Symlinks are not followed during size measurement, licence detection or cleanup.
- Failed imports remove their local clone; project deletion cascades to repository metadata, commits, jobs and storage.
- ZIP import: file-size and entry-count limits, extraction-bomb detection, path-traversal rejection, symlink rejection, cleanup of temporary files.
- Never execute imported scripts, install commands, hooks or build commands. Repository files are treated as inert evidence only.

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
| graphology, tree-sitter, diff (Phase 5+) | see lockfile | MIT / BSD |

Before adding any package: verify it is not already present, check compatibility, maintenance and licence, then update this table.

## Privacy and AI

- Source code is never sent to an external AI provider without explicit user consent.
- AI is opt-in and disabled by default; local Ollama is the preferred provider.
- Answers must cite evidence and must not claim knowledge of undocumented developer intent.
- Repository and user data deletion must be supported.
