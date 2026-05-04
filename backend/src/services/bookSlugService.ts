import { prisma } from '../lib/prisma.js'
import { slugifyTitle } from '../utils/slug.js'

export async function ensureUniqueBookSlug(title: string): Promise<string> {
  const base = slugifyTitle(title)
  let slug = base
  let n = 0
  while (true) {
    const clash = await prisma.book.findUnique({ where: { slug }, select: { id: true } })
    if (!clash) return slug
    n += 1
    slug = `${base}-${n}`
  }
}
