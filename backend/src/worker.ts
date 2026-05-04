import 'dotenv/config'
import { env } from './config/env.js'

console.log(`[worker] boot (NODE_ENV=${env.NODE_ENV}) — BullMQ processors will register here`)

const heartbeatMs = 60000
setInterval(() => {
  console.log('[worker] heartbeat')
}, heartbeatMs)
