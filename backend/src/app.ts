import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { env } from './config/env.js'
import { errorHandler } from './middlewares/errorHandler.js'
import { notFoundHandler } from './middlewares/notFoundHandler.js'
import { registerRoutes } from './routes/index.js'

export function createApp() {
  const app = express()

  app.set('trust proxy', 1)
  app.disable('x-powered-by')
  app.use(helmet())
  app.use(cookieParser())
  app.use(
    cors({
      origin: env.WEB_APP_ORIGIN,
      credentials: true,
    }),
  )
  app.use(express.json({ limit: '1mb' }))

  registerRoutes(app)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
