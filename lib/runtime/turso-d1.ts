import { createClient, type Client, type InValue, type ResultSet } from '@tursodatabase/serverless/compat'

type D1BindableValue = string | number | boolean | bigint | null | ArrayBuffer | ArrayBufferView | Date | undefined

function normalizeArg(value: D1BindableValue): InValue {
  if (value === undefined) return null
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength))
  }
  return value as InValue
}

function normalizeValue(value: unknown): unknown {
  if (typeof value === 'bigint') {
    const asNumber = Number(value)
    return Number.isSafeInteger(asNumber) ? asNumber : value.toString()
  }
  if (value instanceof Date) return value.toISOString()
  return value
}

function rowToObject(row: unknown, columns: string[]): Record<string, unknown> {
  const record = row as Record<string, unknown>
  const result: Record<string, unknown> = {}

  for (const column of columns) {
    result[column] = normalizeValue(record[column])
  }

  return result
}

class TursoD1PreparedStatement implements D1PreparedStatement {
  private readonly client: Client
  private readonly query: string
  private readonly values: InValue[]

  constructor(client: Client, query: string, values: InValue[] = []) {
    this.client = client
    this.query = query
    this.values = values
  }

  bind(...values: D1BindableValue[]): D1PreparedStatement {
    return new TursoD1PreparedStatement(this.client, this.query, values.map(normalizeArg))
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const result = await this.execute()
    const firstRow = result.rows[0]
    return firstRow ? rowToObject(firstRow, result.columns) as T : null
  }

  async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
    const result = await this.execute()
    return {
      results: result.rows.map((row) => rowToObject(row, result.columns) as T),
    }
  }

  async run(): Promise<{ meta: { last_row_id: number } }> {
    const result = await this.execute()
    return {
      meta: {
        last_row_id: Number(result.lastInsertRowid ?? 0),
      },
    }
  }

  private execute(): Promise<ResultSet> {
    return this.client.execute({
      sql: this.query,
      args: this.values,
    })
  }
}

class TursoD1Database implements D1Database {
  private readonly client: Client

  constructor(client: Client) {
    this.client = client
  }

  prepare(query: string): D1PreparedStatement {
    return new TursoD1PreparedStatement(this.client, query)
  }
}

let cachedDatabase: D1Database | undefined
let cachedSignature = ''

export function createTursoD1Database(options: {
  url: string
  authToken?: string
}): D1Database {
  const signature = `${options.url}\n${options.authToken || ''}`
  if (cachedDatabase && cachedSignature === signature) {
    return cachedDatabase
  }

  cachedSignature = signature
  cachedDatabase = new TursoD1Database(createClient({
    url: options.url,
    authToken: options.authToken,
  }))
  return cachedDatabase
}

export function resolveTursoConfigFromEnv(env: NodeJS.ProcessEnv = process.env) {
  const url = (
    env.TURSO_DATABASE_URL ||
    env.LIBSQL_DATABASE_URL ||
    env.DATABASE_URL ||
    ''
  ).trim()

  if (!url || !/^(libsql|https?|file):/i.test(url)) {
    return null
  }

  return {
    url,
    authToken: (
      env.TURSO_AUTH_TOKEN ||
      env.LIBSQL_AUTH_TOKEN ||
      env.DATABASE_AUTH_TOKEN ||
      ''
    ).trim() || undefined,
  }
}
