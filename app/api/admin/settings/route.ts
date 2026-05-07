import { getSetting, setSetting } from '@/lib/db'
import { authenticateCookieRequest } from '@/lib/admin-auth'
import { getRouteEnvWithDb, jsonError, jsonInternalError, jsonOk, parseJsonBody } from '@/lib/server/route-helpers'
import type { NextRequest } from 'next/server'

async function getAuthorizedRoute(req: NextRequest) {
  const route = await getRouteEnvWithDb('No DB')
  if (!route.ok) return route
  if (!(await authenticateCookieRequest(req, route.db))) {
    return {
      ok: false as const,
      response: jsonError('Unauthorized', 401),
    }
  }
  return route
}

export async function GET(req: NextRequest) {
  try {
    const route = await getAuthorizedRoute(req)
    if (!route.ok) return route.response

    const key = req.nextUrl.searchParams.get('key')
    if (!key) {
      return jsonError('Missing key', 400)
    }

    const value = await getSetting(route.db, key)
    return jsonOk({ key, value })
  } catch (error) {
    console.error('Get setting error:', error)
    return jsonInternalError('获取设置失败，请稍后重试')
  }
}

export async function POST(req: NextRequest) {
  try {
    const route = await getAuthorizedRoute(req)
    if (!route.ok) return route.response

    const { key, value } = await parseJsonBody<{ key?: string; value?: unknown }>(req)
    if (!key || value === undefined) {
      return jsonError('Missing key or value', 400)
    }

    await setSetting(route.db, key, typeof value === 'string' ? value : JSON.stringify(value))
    return jsonOk({ success: true })
  } catch (error) {
    console.error('Set setting error:', error)
    return jsonInternalError('保存设置失败，请稍后重试')
  }
}
