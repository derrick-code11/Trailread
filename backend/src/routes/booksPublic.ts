import { Router } from 'express'
import { asyncHandler } from '../middlewares/asyncHandler.js'
import { AppError } from '../errors/AppError.js'
import { requireAuth } from '../middlewares/requireAuth.js'
import { booksListQuerySchema } from '../schemas/booksPublic.js'
import * as booksPublicService from '../services/booksPublicService.js'
import * as readerBooksService from '../services/readerBooksService.js'
import { pathParam } from '../utils/pathParams.js'

export const booksPublicRouter = Router()

booksPublicRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = booksListQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 422, 'Invalid query', parsed.error.flatten())
    }
    const result = await booksPublicService.listPublishedBooks(parsed.data)
    res.json(result)
  }),
)

booksPublicRouter.post(
  '/:bookId/start',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.auth!.user.id
    const bookId = pathParam('bookId', req.params.bookId)
    const result = await readerBooksService.startBook(userId, bookId)
    res.json(result)
  }),
)

booksPublicRouter.get(
  '/:bookSlug',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.auth!.user.id
    const result = await readerBooksService.getReaderBookBySlug(userId, pathParam('bookSlug', req.params.bookSlug))
    res.json(result)
  }),
)
