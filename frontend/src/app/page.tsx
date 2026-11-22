import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

const practices = [
  {
    number: '01',
    title: 'Commit history',
    body: 'Hashes, authors, timestamps, parents and changed files, preserved exactly as Git recorded them.',
  },
  {
    number: '02',
    title: 'Structure & symbols',
    body: 'AST-based extraction of modules, classes, functions and imports from JavaScript, TypeScript and Java.',
  },
  {
    number: '03',
    title: 'Dependency evidence',
    body: 'Component graphs, coupling and cycles reconstructed from real imports at selected historical snapshots.',
  },
  {
    number: '04',
    title: 'Evidence-backed narrative',
    body: 'Every detected change carries its supporting commits and paths. Unknown history stays unknown.',
  },
];

const steps = [
  ['Import', 'Connect a public HTTPS Git repository.'],
  ['Examine', 'Extract commits, contributors and file changes.'],
  ['Reconstruct', 'Select meaningful snapshots and parse their structure.'],
  ['Interpret', 'Compare versions and inspect the evidence behind each claim.'],
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-paper-raised/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <div>
            <p className="eyebrow">Software archaeology</p>
            <p className="mt-1 font-display text-lg">Digital Archaeologist</p>
          </div>
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/login" className="text-ink-soft hover:text-ink">
              Sign in
            </Link>
            <Link
              href="/register"
              className="border border-ink bg-ink px-4 py-2 text-paper-raised hover:bg-clay hover:border-clay"
            >
              Create an account
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-20 sm:pt-28">
        <p className="eyebrow">Field report · 0.1.0</p>
        <h1 className="mt-5 max-w-4xl font-display text-4xl leading-[1.12] tracking-tight text-ink sm:text-6xl">
          Every codebase has a history.
          <span className="block text-clay">Make it discoverable.</span>
        </h1>
        <p className="mt-7 max-w-2xl text-base leading-relaxed text-ink-soft sm:text-lg">
          Digital Archaeologist reconstructs how software came to be — from commits,
          source structure and dependency evidence. It is a research instrument for
          developers, not a generator of plausible stories.
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 border border-ink bg-ink px-5 py-3 text-sm font-medium text-paper-raised hover:border-clay hover:bg-clay"
          >
            Begin an excavation <ArrowRight size={16} />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center border border-line-strong bg-paper-raised px-5 py-3 text-sm hover:border-ink"
          >
            Return to your workspace
          </Link>
        </div>
        <p className="mt-6 font-mono text-[0.7rem] uppercase tracking-wider text-ink-faint">
          Current release: accounts and project records. Repository analysis arrives in Phase 2.
        </p>
      </section>

      <section className="border-y border-line bg-paper-raised/60">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <p className="eyebrow">What the archive examines</p>
          <div className="mt-8 grid gap-px border border-line bg-line sm:grid-cols-2">
            {practices.map((item) => (
              <article key={item.number} className="bg-paper-raised p-7">
                <p className="font-mono text-xs text-clay">{item.number}</p>
                <h2 className="mt-4 font-display text-2xl text-ink">{item.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-ink-soft">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <p className="eyebrow">Method</p>
        <div className="mt-8 grid gap-8 sm:grid-cols-4">
          {steps.map(([title, body], index) => (
            <div key={title} className="border-t border-line-strong pt-5">
              <p className="font-mono text-[0.7rem] text-ink-faint">STEP {index + 1}</p>
              <h3 className="mt-2 font-display text-xl">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-line bg-paper-raised/60">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-2">
          <div>
            <p className="eyebrow">Technology</p>
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              NestJS and MongoDB on the server; Next.js, Redux Toolkit and React Flow on the
              client. Parsing uses Tree-sitter; graphs use Graphology. Everything runs locally
              without paid infrastructure.
            </p>
          </div>
          <div>
            <p className="eyebrow">Evidence policy</p>
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              Observed facts, detected changes, interpretations and unknowns are kept separate.
              AI explanations are optional, disabled by default and always tied to commit
              references. Public code remains subject to its licence and copyright.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-6 py-8 font-mono text-[0.7rem] text-ink-faint">
          DIGITAL ARCHAEOLOGIST · LOCAL-FIRST RESEARCH INSTRUMENT · 2026
        </div>
      </footer>
    </div>
  );
}
