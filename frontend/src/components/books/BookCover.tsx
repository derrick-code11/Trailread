import { useState } from 'react'

import { cn } from '@/lib/utils'

type BookCoverProps = {
  title: string
  author?: string | null
  coverUrl?: string | null
  className?: string
}

export function BookCover({ title, author, coverUrl, className }: BookCoverProps) {
  const [failedCoverUrl, setFailedCoverUrl] = useState<string | null>(null)
  const coverImageUrl = coverUrl && failedCoverUrl !== coverUrl ? coverUrl : null

  return (
    <div
      className={cn(
        'relative aspect-[2/3] overflow-hidden rounded-[10px] border border-black/10 bg-[var(--color-bg-sunken)] shadow-[0_10px_24px_rgba(28,26,22,0.14),0_2px_5px_rgba(28,26,22,0.12)]',
        className,
      )}
    >
      {coverImageUrl ? (
        <img
          src={coverImageUrl}
          alt={`Cover for ${title}`}
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setFailedCoverUrl(coverImageUrl)}
        />
      ) : (
        <div className="flex h-full flex-col justify-between bg-[var(--color-primary-900)] p-4 text-[var(--color-text-inverse)]">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-75">Trailread</p>
            <h3 className="mt-8 line-clamp-5 font-display text-lg font-semibold leading-tight">{title}</h3>
          </div>
          <p className="line-clamp-3 text-xs font-medium opacity-80">{author ?? 'Unknown author'}</p>
        </div>
      )}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[11%] bg-black/10 mix-blend-multiply" aria-hidden />
      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/20" aria-hidden />
    </div>
  )
}
