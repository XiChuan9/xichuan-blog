export type Database = D1Database

// 获取数据库实例（Cloudflare D1 或 Vercel/Turso D1-compatible adapter）
export function getDB(env: CloudflareEnv) {
  return env.DB
}

const BASE_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    html TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT '未分类',
    tags TEXT,
    status TEXT DEFAULT 'published' CHECK(status IN ('draft', 'published', 'deleted')),
    password TEXT,
    is_pinned INTEGER DEFAULT 0,
    is_hidden INTEGER DEFAULT 0,
    cover_image TEXT,
    deleted_at INTEGER,
    published_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    view_count INTEGER DEFAULT 0
  )`,
  'CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug)',
  'CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category)',
  'CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(published_at DESC)',
  `CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(
    title,
    content,
    content=posts,
    content_rowid=id,
    tokenize='unicode61'
  )`,
  `CREATE TRIGGER IF NOT EXISTS posts_ai AFTER INSERT ON posts BEGIN
    INSERT INTO posts_fts(rowid, title, content)
    VALUES (new.id, new.title, new.content);
  END`,
  `CREATE TRIGGER IF NOT EXISTS posts_au AFTER UPDATE ON posts BEGIN
    UPDATE posts_fts SET title = new.title, content = new.content
    WHERE rowid = new.id;
  END`,
  `CREATE TRIGGER IF NOT EXISTS posts_ad AFTER DELETE ON posts BEGIN
    DELETE FROM posts_fts WHERE rowid = old.id;
  END`,
  `CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    post_count INTEGER DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  "INSERT OR IGNORE INTO categories (name, slug) VALUES ('未分类', 'uncategorized')",
  "INSERT OR IGNORE INTO categories (name, slug) VALUES ('AI工具', 'ai-tools')",
  "INSERT OR IGNORE INTO categories (name, slug) VALUES ('AI', 'ai')",
  "INSERT OR IGNORE INTO site_settings (key, value) VALUES ('default_theme', 'editorial')",
  "INSERT OR IGNORE INTO site_settings (key, value) VALUES ('body_font', 'serif')",
  `INSERT OR IGNORE INTO site_settings (key, value) VALUES (
    'nav_links',
    '[{"label":"GitHub","url":"https://github.com/joeseesun/qiaomu-blog-opensource","openInNewTab":true},{"label":"Admin","url":"/admin","openInNewTab":false},{"label":"RSS","url":"/feed.xml","openInNewTab":false}]'
  )`,
]

// 自动迁移：确保基础表和列存在。
// Cloudflare 生产仍建议走 wrangler d1 migrations；Vercel/Turso 可在首次请求自举。
let schemaInitialized = false

export async function ensureSchema(db: Database) {
  if (schemaInitialized) return

  try {
    for (const sql of BASE_SCHEMA_STATEMENTS) {
      await db.prepare(sql).run()
    }

    // 安全地添加新列（ALTER TABLE ADD COLUMN 在列已存在时会报错，所以需要 try/catch）
    const columnMigrations = [
      "ALTER TABLE posts ADD COLUMN password TEXT",
      "ALTER TABLE posts ADD COLUMN is_pinned INTEGER DEFAULT 0",
      "ALTER TABLE posts ADD COLUMN is_hidden INTEGER DEFAULT 0",
      "ALTER TABLE posts ADD COLUMN deleted_at INTEGER",
      "ALTER TABLE posts ADD COLUMN cover_image TEXT",
    ]
    for (const sql of columnMigrations) {
      try {
        await db.prepare(sql).run()
      } catch {
        // column already exists
      }
    }

    try {
      await db.prepare("INSERT INTO posts_fts(posts_fts) VALUES ('rebuild')").run()
    } catch {
      // FTS rebuild is best-effort because some SQLite-compatible runtimes disable FTS5.
    }

    schemaInitialized = true
  } catch (error: unknown) {
    console.error('Schema migration failed:', error)
  }
}
