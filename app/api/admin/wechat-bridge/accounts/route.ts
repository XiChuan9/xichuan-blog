import type { NextRequest } from 'next/server'
import { ensureAuthenticatedRequest, getRouteEnvWithDb, jsonInternalError, jsonOk } from '@/lib/server/route-helpers'
import {
  assertWechatBridgeReady,
  fetchWechatBridgeJson,
  getWechatBridgeConfig,
  type WechatBridgeAccount,
} from '@/lib/wechat-bridge-config'

export async function GET(req: NextRequest) {
  const route = await getRouteEnvWithDb('DB unavailable')
  if (!route.ok) return route.response

  const unauthorized = await ensureAuthenticatedRequest(req, route.db)
  if (unauthorized) return unauthorized

  try {
    const config = assertWechatBridgeReady(await getWechatBridgeConfig(route.db, route.env))
    const response = await fetchWechatBridgeJson<{ accounts?: WechatBridgeAccount[] }>(config, '/v1/accounts')

    return jsonOk({
      accounts: response.accounts || [],
    })
  } catch (error) {
    console.error('Fetch WeChat bridge accounts failed:', error)
    return jsonInternalError('获取 bridge 账号列表失败，请稍后重试')
  }
}
