import { Router } from 'express'
import { asyncHandler } from '../middlewares/asyncHandler.js'
import { requireAuth } from '../middlewares/requireAuth.js'
import { validateBody } from '../middlewares/validateBody.js'
import { quizAttemptBodySchema } from '../schemas/chapterArtifacts.js'
import { chapterChatBodySchema } from '../schemas/chapterChat.js'
import { completeChapterBodySchema, progressEventsBodySchema } from '../schemas/chapterReader.js'
import { highlightHelpBodySchema, highlightPronunciationBodySchema } from '../schemas/highlightHelp.js'
import * as chapterArtifactsService from '../services/chapterArtifactsService.js'
import * as chapterChatService from '../services/chapterChatService.js'
import * as chapterProgressService from '../services/chapterProgressService.js'
import * as highlightHelpService from '../services/highlightHelpService.js'
import * as readerBooksService from '../services/readerBooksService.js'
import { pathParam } from '../utils/pathParams.js'

export const chaptersPublicRouter = Router()

chaptersPublicRouter.get(
  '/:chapterId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.auth!.user.id
    const result = await readerBooksService.getReaderChapter(userId, pathParam('chapterId', req.params.chapterId))
    res.json(result)
  }),
)

chaptersPublicRouter.post(
  '/:chapterId/progress/events',
  requireAuth,
  validateBody(progressEventsBodySchema),
  asyncHandler(async (req, res) => {
    const userId = req.auth!.user.id
    const chapterId = pathParam('chapterId', req.params.chapterId)
    const result = await chapterProgressService.appendProgressEvents(userId, chapterId, req.body)
    res.json(result)
  }),
)

chaptersPublicRouter.post(
  '/:chapterId/complete',
  requireAuth,
  validateBody(completeChapterBodySchema),
  asyncHandler(async (req, res) => {
    const userId = req.auth!.user.id
    const chapterId = pathParam('chapterId', req.params.chapterId)
    const result = await chapterProgressService.completeChapter(userId, chapterId)
    res.json(result)
  }),
)

chaptersPublicRouter.post(
  '/:chapterId/highlight-help',
  requireAuth,
  validateBody(highlightHelpBodySchema),
  asyncHandler(async (req, res) => {
    const userId = req.auth!.user.id
    const chapterId = pathParam('chapterId', req.params.chapterId)
    const result = await highlightHelpService.runHighlightHelp(userId, chapterId, req.body)
    res.json(result)
  }),
)

chaptersPublicRouter.post(
  '/:chapterId/highlight-pronunciation',
  requireAuth,
  validateBody(highlightPronunciationBodySchema),
  asyncHandler(async (req, res) => {
    const userId = req.auth!.user.id
    const chapterId = pathParam('chapterId', req.params.chapterId)
    const audio = await highlightHelpService.synthesizeHighlightPronunciation(userId, chapterId, req.body)
    res
      .status(200)
      .set({
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'private, max-age=3600',
      })
      .send(audio)
  }),
)

chaptersPublicRouter.post(
  '/:chapterId/chat',
  requireAuth,
  validateBody(chapterChatBodySchema),
  asyncHandler(async (req, res) => {
    const userId = req.auth!.user.id
    const chapterId = pathParam('chapterId', req.params.chapterId)
    const result = await chapterChatService.runChapterChat(userId, chapterId, req.body)
    res.json(result)
  }),
)

chaptersPublicRouter.get(
  '/:chapterId/summary',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.auth!.user.id
    const chapterId = pathParam('chapterId', req.params.chapterId)
    const result = await chapterArtifactsService.getChapterSummary(userId, chapterId)
    res.json(result)
  }),
)

chaptersPublicRouter.get(
  '/:chapterId/quiz',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.auth!.user.id
    const chapterId = pathParam('chapterId', req.params.chapterId)
    const result = await chapterArtifactsService.getChapterQuiz(userId, chapterId)
    res.json(result)
  }),
)

chaptersPublicRouter.post(
  '/:chapterId/quiz-attempts',
  requireAuth,
  validateBody(quizAttemptBodySchema),
  asyncHandler(async (req, res) => {
    const userId = req.auth!.user.id
    const chapterId = pathParam('chapterId', req.params.chapterId)
    const result = await chapterArtifactsService.submitChapterQuizAttempt(userId, chapterId, req.body)
    res.json(result)
  }),
)

chaptersPublicRouter.post(
  '/:chapterId/podcast',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.auth!.user.id
    const chapterId = pathParam('chapterId', req.params.chapterId)
    const result = await chapterArtifactsService.requestChapterPodcast(userId, chapterId)
    res.json(result)
  }),
)

chaptersPublicRouter.get(
  '/:chapterId/podcast',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.auth!.user.id
    const chapterId = pathParam('chapterId', req.params.chapterId)
    const result = await chapterArtifactsService.getChapterPodcastStatus(userId, chapterId)
    res.json(result)
  }),
)
