import { ensureSchema, type Database } from '@/lib/repositories/schema'
import type { CategoryRow } from '@/lib/repositories/types'

const DEFAULT_CATEGORY_NAME = '未分类'
const DEFAULT_CATEGORY_SLUG = 'uncategorized'

async function runCategoryMutation(db: Database, statements: D1PreparedStatement[]) {
  const maybeBatch = (db as Database & {
    batch?: (statements: D1PreparedStatement[]) => Promise<unknown>
  }).batch

  if (typeof maybeBatch === 'function') {
    await maybeBatch.call(db, statements)
    return
  }

  for (const statement of statements) {
    await statement.run()
  }
}

// 获取所有分类
export async function getCategories(db: Database): Promise<CategoryRow[]> {
  await ensureSchema(db)
  const { results } = await db
    .prepare('SELECT name, slug, post_count FROM categories ORDER BY name')
    .all<CategoryRow>()

  return results
}

export async function getPublicCategories(db: Database): Promise<CategoryRow[]> {
  await ensureSchema(db)
  const { results } = await db
    .prepare(
      `SELECT categories.name, categories.slug, COUNT(posts.id) as post_count
       FROM categories
       JOIN posts
         ON posts.category = categories.name
       WHERE posts.status = 'published'
         AND posts.password IS NULL
         AND posts.is_hidden = 0
         AND posts.deleted_at IS NULL
       GROUP BY categories.name, categories.slug
       ORDER BY categories.name`,
    )
    .all<CategoryRow>()

  return results
}

// 创建分类
export async function createCategory(db: Database, name: string, slug: string): Promise<void> {
  await ensureSchema(db)
  await db.prepare('INSERT OR IGNORE INTO categories (name, slug) VALUES (?, ?)').bind(name, slug).run()
}

// 更新分类
export async function updateCategory(db: Database, oldSlug: string, name: string, newSlug: string): Promise<void> {
  await ensureSchema(db)
  const cat = await db
    .prepare('SELECT name FROM categories WHERE slug = ?')
    .bind(oldSlug)
    .first<Pick<CategoryRow, 'name'>>()

  if (!cat) return

  await runCategoryMutation(db, [
    db.prepare('UPDATE categories SET name = ?, slug = ? WHERE slug = ?').bind(name, newSlug, oldSlug),
    db.prepare('UPDATE posts SET category = ? WHERE category = ?').bind(name, cat.name),
  ])
}

// 删除分类
export async function deleteCategory(db: Database, slug: string): Promise<void> {
  await ensureSchema(db)
  if (slug === DEFAULT_CATEGORY_SLUG) {
    throw new Error('默认分类不能删除')
  }

  const cat = await db
    .prepare('SELECT name FROM categories WHERE slug = ?')
    .bind(slug)
    .first<Pick<CategoryRow, 'name'>>()

  if (!cat) return

  await runCategoryMutation(db, [
    db.prepare('INSERT OR IGNORE INTO categories (name, slug) VALUES (?, ?)').bind(DEFAULT_CATEGORY_NAME, DEFAULT_CATEGORY_SLUG),
    db.prepare('UPDATE categories SET post_count = post_count + (SELECT COUNT(*) FROM posts WHERE category = ?) WHERE slug = ?')
      .bind(cat.name, DEFAULT_CATEGORY_SLUG),
    db.prepare('UPDATE posts SET category = ? WHERE category = ?').bind(DEFAULT_CATEGORY_NAME, cat.name),
    db.prepare('DELETE FROM categories WHERE slug = ?').bind(slug),
  ])
}
