import { Router } from 'express'
import { asyncHandler } from '../middlewares/asyncHandler.js'
import { requireAdmin } from '../middlewares/requireAdmin.js'
import { requireAuth } from '../middlewares/requireAuth.js'
import { validateBody } from '../middlewares/validateBody.js'
import { AppError } from '../errors/AppError.js'
import {
  adminBooksListQuerySchema,
  adminImportBodySchema,
  adminPatchChapterBodySchema,
  gutenbergSearchQuerySchema,
} from '../schemas/admin.js'
import * as adminBooksService from '../services/adminBooksService.js'
import { searchGutendex } from '../services/gutendexService.js'
import { pathParam } from '../utils/pathParams.js'

export const adminRouter = Router()

adminRouter.use(requireAuth, requireAdmin)

adminRouter.get(
  '/ping',
  asyncHandler((_req, res) => {
    res.json({ ok: true })
  }),
)

adminRouter.get(
  '/books',
  asyncHandler(async (req, res) => {
    const parsed = adminBooksListQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 422, 'Invalid query', parsed.error.flatten())
    }
    const result = await adminBooksService.listAdminBooks(parsed.data)
    res.json(result)
  }),
)

adminRouter.get(
  '/gutenberg/search',
  asyncHandler(async (req, res) => {
    const parsed = gutenbergSearchQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 422, 'Invalid query', parsed.error.flatten())
    }
    const data = await searchGutendex(parsed.data.q)
    res.json({ data })
  }),
)

adminRouter.post(
  '/books/import',
  validateBody(adminImportBodySchema),
  asyncHandler(async (req, res) => {
    const result = await adminBooksService.importBook(req.body.gutenbergId)
    res.status(201).json(result)
  }),
)

adminRouter.delete(
  '/books/:bookId',
  asyncHandler(async (req, res) => {
    await adminBooksService.deleteBook(pathParam('bookId', req.params.bookId))
    res.status(204).send()
  }),
)

adminRouter.get(
  '/books/:bookId/ingestion-jobs/:jobId',
  asyncHandler(async (req, res) => {
    const result = await adminBooksService.getIngestionJob(
      pathParam('bookId', req.params.bookId),
      pathParam('jobId', req.params.jobId),
    )
    res.json(result)
  }),
)

adminRouter.get(
  '/books/:bookId/review',
  asyncHandler(async (req, res) => {
    const result = await adminBooksService.getReviewPayload(pathParam('bookId', req.params.bookId))
    res.json(result)
  }),
)

adminRouter.get(
  '/chapters/:chapterId/content',
  asyncHandler(async (req, res) => {
    const result = await adminBooksService.getAdminChapterContent(pathParam('chapterId', req.params.chapterId))
    res.json(result)
  }),
)

adminRouter.patch(
  '/chapters/:chapterId',
  validateBody(adminPatchChapterBodySchema),
  asyncHandler(async (req, res) => {
    const updated = await adminBooksService.patchChapter(pathParam('chapterId', req.params.chapterId), req.body)
    res.json({ chapter: updated })
  }),
)

adminRouter.post(
  '/books/:bookId/publish',
  asyncHandler(async (req, res) => {
    await adminBooksService.publishBook(pathParam('bookId', req.params.bookId))
    res.json({ ok: true })
  }),
)

adminRouter.post(
  '/books/:bookId/unpublish',
  asyncHandler(async (req, res) => {
    await adminBooksService.unpublishBook(pathParam('bookId', req.params.bookId))
    res.json({ ok: true })
  }),
)
