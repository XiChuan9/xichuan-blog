import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-wider text-[var(--editor-muted)]">404</p>
      <h1 className="mt-3 text-3xl font-semibold text-[var(--editor-ink)]">Page not found</h1>
      <p className="mt-4 text-sm leading-6 text-[var(--editor-muted)]">
        The post or page may have been moved, hidden, or deleted.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex w-fit rounded-lg bg-[var(--editor-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105"
      >
        Back to home
      </Link>
    </main>
  )
}
