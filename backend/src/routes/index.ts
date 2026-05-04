import type { Express, Request, Response } from 'express'
import { Router } from 'express'
import { adminRouter } from './admin.js'
import { authRouter } from './auth.js'
import { booksPublicRouter } from './booksPublic.js'
import { chaptersPublicRouter } from './chaptersPublic.js'

const apiRouter = Router()

apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' })
})

apiRouter.use('/auth', authRouter)
apiRouter.use('/admin', adminRouter)
apiRouter.use('/books', booksPublicRouter)
apiRouter.use('/chapters', chaptersPublicRouter)

export function registerRoutes(app: Express): void {
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  app.use('/api/v1', apiRouter)
}
