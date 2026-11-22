# Digital Archaeologist

> Every codebase has a history. Digital Archaeologist makes that history discoverable.

A web-based software engineering intelligence platform that reconstructs, analyses and explains how a software project evolved, using Git history, source code and structural evidence.

## Current status

**Phases 0, 1 and 2 complete.** The application provides authentication, project management, validated public HTTPS Git repository import, persisted analysis jobs, and real Git history/timeline data (commits, refs, contributors, licence and file changes) in the Next.js interface. No fake data is generated anywhere in the application.

## Requirements

- Node.js 20.11+ (developed and tested on 22.14.0)
- npm 10+
- Git
- MongoDB Community Edition, running locally on `127.0.0.1:27017`
- Redis is **not** required at this stage

## Local setup

```powershell
# 1. Install all workspace dependencies from the repository root
npm install

# 2. Create your environment file and replace the JWT secrets
Copy-Item .env.example .env

# 3. Confirm MongoDB is running (Windows service name is usually MongoDB)
Get-Service MongoDB

# 4. Start the two servers in separate terminals
npm run dev:backend    # http://localhost:3001/api/v1
npm run dev:frontend   # http://localhost:3000
```

The frontend also reads `frontend/.env.local` if you prefer to keep its `NEXT_PUBLIC_*` settings next to the Next.js app.

## Useful commands

| Command | Description |
|---|---|
| `npm run build` | Build backend and frontend |
| `npm test` | Run backend unit tests |
| `npm run test:e2e` | Run backend integration tests (needs MongoDB running) |
| `npm run lint` | Lint both workspaces |

## Workspace layout

```
backend/    NestJS REST API, MongoDB persistence, repository import and Git analysis
frontend/   Next.js App Router UI, repository import panel and history view
storage/    Local Git working copies (created at runtime, ignored by Git)
docs/       Architecture, database, API, security and roadmap documentation
```

See [docs/IMPLEMENTATION_ROADMAP.md](docs/IMPLEMENTATION_ROADMAP.md) for the full delivery plan and [docs/DEVELOPMENT_LOG.md](docs/DEVELOPMENT_LOG.md) for progress records.

## Licensing note

Imported repositories remain subject to their own licences and copyright. Public availability is not permission to redistribute source code. The project's dependency licence inventory is maintained in [docs/SECURITY_AND_LEGAL.md](docs/SECURITY_AND_LEGAL.md).
