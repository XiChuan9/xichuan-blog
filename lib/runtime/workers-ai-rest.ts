function parseWorkersAiError(status: number, rawBody: string) {
  try {
    const parsed = rawBody ? JSON.parse(rawBody) as {
      errors?: Array<{ message?: string }>
      error?: { message?: string } | string
      message?: string
    } : null

    const firstError = parsed?.errors?.find((item) => item.message?.trim())
    if (firstError?.message) return firstError.message.trim()
    if (typeof parsed?.error === 'object' && parsed.error?.message) return parsed.error.message.trim()
    if (typeof parsed?.error === 'string' && parsed.error.trim()) return parsed.error.trim()
    if (parsed?.message?.trim()) return parsed.message.trim()
  } catch {
    // fall through to raw body
  }

  return rawBody.trim() || `Workers AI request failed: HTTP ${status}`
}

export function createWorkersAiRestBinding(options: {
  accountId: string
  apiToken: string
}): WorkersAIBinding {
  return {
    async run(model, input) {
      const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(options.accountId)}/ai/run/${model.trim()}`
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(9000),
      })

      const contentType = response.headers.get('content-type') || ''
      if (response.ok && contentType.startsWith('image/')) {
        return response
      }

      const rawBody = await response.text().catch(() => '')
      if (!response.ok) {
        throw new Error(parseWorkersAiError(response.status, rawBody))
      }

      return rawBody ? JSON.parse(rawBody) : null
    },
  }
}
