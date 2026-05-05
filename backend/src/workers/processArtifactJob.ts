import { ArtifactType } from '@prisma/client'
import { processArtifactJob } from '../services/chapterArtifactsService.js'

export async function processQueuedArtifactJob(chapterId: string, type: ArtifactType): Promise<void> {
  await processArtifactJob(chapterId, type)
}
