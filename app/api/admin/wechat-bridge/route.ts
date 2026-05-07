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
  getWechatBridgePublicConfig,
  normalizeWechatBridgeBaseUrl,
  saveWechatBridgeConfig,
} from '@/lib/wechat-bridge-config'

interface SaveWechatBridgeBody {
  enabled?: boolean
  base_url?: string
  token?: string
}

export async function GET(req: NextRequest) {
  const route = await getRouteEnvWithDb('DB unavailable')
  if (!route.ok) return route.response

  const unauthorized = await ensureAuthenticatedRequest(req, route.db)
  if (unauthorized) return unauthorized

  const config = await getWechatBridgePublicConfig(route.db, route.env)
  return jsonOk({ config })
}

export async function PUT(req: NextRequest) {
  const route = await getRouteEnvWithDb('DB unavailable')
  if (!route.ok) return route.response

  const unauthorized = await ensureAuthenticatedRequest(req, route.db)
  if (unauthorized) return unauthorized

  try {
    const body = await parseJsonBody<SaveWechatBridgeBody>(req)
    const rawBaseUrl = (body.base_url || '').trim()
    const normalizedBaseUrl = normalizeWechatBridgeBaseUrl(rawBaseUrl)

    if (!normalizedBaseUrl.ok) {
      return jsonError(normalizedBaseUrl.error, 400)
    }

    if (body.enabled && !normalizedBaseUrl.url) {
      return jsonError('启用 bridge 前需要填写 Base URL', 400)
    }

    const config = await saveWechatBridgeConfig(route.db, route.env, {
      enabled: body.enabled,
      base_url: normalizedBaseUrl.url,
      token: body.token,
    })

    return jsonOk({ success: true, config })
  } catch (error) {
    console.error('Save WeChat bridge config failed:', error)
    return jsonInternalError('保存 bridge 配置失败，请稍后重试')
  }
}
