import type { NextRequest } from 'next/server'
import {
  ensureAuthenticatedRequest,
  getRouteEnvWithDb,
  jsonError,
  jsonInternalError,
  jsonOk,
  parseJsonBody,
} from '@/lib/server/route-helpers'
import {
  fetchWechatBridgeJson,
  getWechatBridgeConfig,
  normalizeWechatBridgeBaseUrl,
  type WechatBridgeAccount,
} from '@/lib/wechat-bridge-config'

interface BridgeTestBody {
  base_url?: string
  token?: string
}

export async function POST(req: NextRequest) {
  const route = await getRouteEnvWithDb('DB unavailable')
  if (!route.ok) return route.response

  const unauthorized = await ensureAuthenticatedRequest(req, route.db)
  if (unauthorized) return unauthorized

  try {
    const body = await parseJsonBody<BridgeTestBody>(req)
    const stored = await getWechatBridgeConfig(route.db, route.env)
    const baseUrlResult = normalizeWechatBridgeBaseUrl(body.base_url || stored.base_url || '')
    if (!baseUrlResult.ok) {
      return jsonError(baseUrlResult.error, 400)
    }
    const baseUrl = baseUrlResult.url
    const token = (body.token || '').trim() || stored.token

    if (!baseUrl || !token) {
      return jsonError('请先填写 bridge Base URL 和 Token', 400)
    }

    const bridge = { base_url: baseUrl, token }
    const health = await fetchWechatBridgeJson<{ ok?: boolean; service?: string }>(bridge, '/health')
    const accountsResponse = await fetchWechatBridgeJson<{ accounts?: WechatBridgeAccount[] }>(bridge, '/v1/accounts')

    return jsonOk({
      success: true,
      health,
      accounts: accountsResponse.accounts || [],
    })
  } catch (error) {
    console.error('Test WeChat bridge connection failed:', error)
    return jsonInternalError('测试 bridge 连接失败，请稍后重试')
  }
}
