import { beforeEach, describe, expect, it, vi } from 'vitest'

function createMockDb(options: { failFirstFtsRebuild?: boolean } = {}) {
  const statements: string[] = []
  let rebuildAttempts = 0

  const db = {
    prepare(sql: string) {
      statements.push(sql)
      return {
        bind() {
          return this
        },
        async run() {
          if (sql === "INSERT INTO posts_fts(posts_fts) VALUES ('rebuild')") {
            rebuildAttempts += 1
            if (options.failFirstFtsRebuild && rebuildAttempts === 1) {
              throw new Error('database disk image is malformed')
            }
          }
          return { meta: { last_row_id: 0 } }
        },
      }
    },
  }

  return {
    db: db as unknown as D1Database,
    statements,
  }
}

describe('ensureSchema', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('installs FTS5 external-content triggers using delete and insert rows', async () => {
    const { ensureSchema } = await import('@/lib/repositories/schema')
    const { db, statements } = createMockDb()

    await ensureSchema(db)

    expect(statements).toContain('DROP TRIGGER IF EXISTS posts_ai')
    expect(statements).toContain('DROP TRIGGER IF EXISTS posts_au')
    expect(statements).toContain('DROP TRIGGER IF EXISTS posts_ad')
    expect(statements.some((sql) => sql.includes('UPDATE posts_fts SET'))).toBe(false)
    expect(statements.some((sql) => sql.includes('DELETE FROM posts_fts WHERE rowid'))).toBe(false)
    expect(statements.some((sql) => sql.includes("VALUES ('delete', old.id, old.title, old.content);"))).toBe(true)
    expect(statements).toContain("INSERT INTO posts_fts(posts_fts) VALUES ('rebuild')")
  })

  it('recreates the FTS table if rebuilding a stale index fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { ensureSchema } = await import('@/lib/repositories/schema')
    const { db, statements } = createMockDb({ failFirstFtsRebuild: true })

    await ensureSchema(db)

    expect(statements).toContain('DROP TABLE IF EXISTS posts_fts')
    expect(statements.filter((sql) => sql === "INSERT INTO posts_fts(posts_fts) VALUES ('rebuild')")).toHaveLength(2)
    warnSpy.mockRestore()
  })
})
