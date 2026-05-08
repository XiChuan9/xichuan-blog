'use client'

import Link from 'next/link'

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-wider text-[var(--editor-muted)]">Error</p>
      <h1 className="mt-3 text-3xl font-semibold text-[var(--editor-ink)]">Something went wrong</h1>
      <p className="mt-4 text-sm leading-6 text-[var(--editor-muted)]">
        The page failed to load. Try again, or return to the homepage.
      </p>
      <div className="mt-8 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-[var(--editor-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-lg border border-[var(--editor-line)] px-4 py-2 text-sm font-semibold text-[var(--editor-ink)] transition hover:bg-[var(--editor-soft)]"
        >
          Home
        </Link>
      </div>
    </main>
  )
}
