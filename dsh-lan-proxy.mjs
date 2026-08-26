// Expose the loopback-bound DeepSeek Harness (127.0.0.1:3080) on the LAN.
// Binds 10.115.10.253:3080 and forwards to 127.0.0.1:3080, preserving the
// Host header so the harness browser-trust fence sees the trusted authority.
// CORS: preflight (OPTIONS) is answered locally with the allowed headers so
// browser clients (Coming-home on :3003) can call the /api RPC directly.
import http from 'node:http'

const LAN_IP = process.env.DSH_LAN_IP || '10.115.10.253'
const LAN_PORT = Number(process.env.DSH_LAN_PORT || 3080)
const TARGET = { host: '127.0.0.1', port: 3080 }

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'Content-Type, Authorization',
  'access-control-max-age': '86400',
}

const server = http.createServer((req, res) => {
  // Answer CORS preflights locally — the harness has no OPTIONS route.
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS)
    res.end()
    return
  }

  // Strip browser-origin markers before forwarding: the harness trust fence
  // requires Origin to equal its own authority (DNS-rebinding defense), which
  // would otherwise 403 every cross-origin browser call from Coming-home.
  // The Host header (preserved below) still has to be a trusted authority, so
  // rebinding protection on the wire is unchanged.
  const { origin: _origin, 'sec-fetch-site': _sfs, 'sec-fetch-mode': _sfm, 'sec-fetch-dest': _sfd, ...rest } = req.headers
  const proxy = http.request(
    {
      host: TARGET.host,
      port: TARGET.port,
      method: req.method,
      path: req.url,
      headers: { ...rest, host: req.headers.host }, // preserve Host for the trust fence
    },
    (pres) => {
      res.writeHead(pres.statusCode || 502, { ...pres.headers, ...CORS_HEADERS })
      pres.pipe(res)
    },
  )
  proxy.on('error', (err) => {
    res.writeHead(502, { 'content-type': 'text/plain', ...CORS_HEADERS })
    res.end(`proxy error: ${err.message}`)
  })
  req.pipe(proxy)
})

server.listen(LAN_PORT, LAN_IP, () => {
  console.log(`dsh-lan-proxy: ${LAN_IP}:${LAN_PORT} -> 127.0.0.1:3080 (CORS enabled)`)
})
