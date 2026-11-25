# Project Overview

## Purpose

Digital Archaeologist reconstructs the development history of software projects from observable evidence: Git commits, branches, tags, source code, ASTs, imports, configuration and documentation. It is a software engineering intelligence tool, not a generic Git viewer and not an AI dashboard.

## Problems it addresses

- How did a project start, and how did its folder structure evolve?
- When were important modules introduced?
- How did dependencies and coupling change over time?
- What structural refactorings actually happened?
- What changed between two historical versions, and what evidence supports that claim?

## Evidence policy

The system separates four kinds of statement:

| Kind | Meaning |
|---|---|
| **Observed fact** | Read directly from Git or a file (commit hash, author, path, timestamp) |
| **Detected change** | Computed deterministically from observed facts (added file, cycle, import edge) |
| **Interpretation** | AI-generated or rule-generated explanation, always labelled as such |
| **Unknown** | No sufficient evidence available; reported explicitly |

An interpretation is never persisted or displayed as a verified historical fact. Commit messages are preserved verbatim but are not trusted as proof of intent.

## Mandatory MVP scope

1. User authentication
2. Project management
3. Public Git repository import (HTTPS URL)
4. Git history, contributor and file-change extraction
5. Development timeline with filters
6. Basic source-code structure analysis (JavaScript, TypeScript, Java)
7. Basic dependency extraction and graph visualisation
8. Historical commit comparison

Evidence-based architecture candidates, confidence levels, two-commit comparison (Git changes, replayed paths, stored symbols/dependencies and bounded side-by-side source text), the opt-in local-only evidence assistant and evidence-based Markdown reports are implemented. Architecture style classification, private repositories and team collaboration are post-MVP work. ZIP snapshot inventory is available for projects without Git history; it never fabricates commits, and historical comparison is labelled unavailable for snapshots.

## Product principles

- No fabricated data, counts, commits, graphs or AI answers.
- Unavailable features are labelled unavailable, never faked.
- Evidence first: every detected or interpreted claim links back to commits and paths.
- Local development must work without paid cloud infrastructure.
- Security and legal constraints are design inputs, not a final hardening pass.
