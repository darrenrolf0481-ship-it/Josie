// Expose the loopback-bound DeepSeek Harness (127.0.0.1:3080) on the LAN.
// Binds 10.115.10.253:3080 and forwards to 127.0.0.1:3080, preserving the
// Host header so the harness browser-trust fence sees the trusted authority.
import http from 'node:http'

const LAN_IP = process.env.DSH_LAN_IP || '10.115.10.253'
const LAN_PORT = Number(process.env.DSH_LAN_PORT || 3080)
const TARGET = { host: '127.0.0.1', port: 3080 }

const server = http.createServer((req, res) => {
  const proxy = http.request(
    {
      host: TARGET.host,
      port: TARGET.port,
      method: req.method,
      path: req.url,
      headers: { ...req.headers, host: req.headers.host }, // preserve Host for the trust fence
    },
    (pres) => {
      res.writeHead(pres.statusCode || 502, pres.headers)
      pres.pipe(res)
    },
  )
  proxy.on('error', (err) => {
    res.writeHead(502, { 'content-type': 'text/plain' })
    res.end(`proxy error: ${err.message}`)
  })
  req.pipe(proxy)
})

server.listen(LAN_PORT, LAN_IP, () => {
  console.log(`dsh-lan-proxy: ${LAN_IP}:${LAN_PORT} -> 127.0.0.1:3080`)
})
