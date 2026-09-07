export function resolveSelfHostedWorkerProxyPath(requestUrl: string, rawWorkerId: string) {
  const pathname = new URL(requestUrl).pathname
  const prefix = `/v1/cloud/workers/${encodeURIComponent(rawWorkerId)}`
  if (!pathname.startsWith(`${prefix}/`)) {
    return null
  }

  return pathname.slice(prefix.length)
}
