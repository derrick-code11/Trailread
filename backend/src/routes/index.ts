import type { Express, Request, Response } from 'express'
import { Router } from 'express'

const apiRouter = Router()

apiRouter.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' })
})

export function registerRoutes(app: Express): void {
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' })
  })

  app.use('/api/v1', apiRouter)
}
