export type ParsedChapter = {
  title: string
  paragraphs: string[]
}

type ChapterCandidate = {
  lineIndex: number
  bodyStartLineIndex: number
  title: string
  confidence: number
}

const MIN_CHAPTER_WORDS = 80
const MIN_CHAPTER_CHARS = 500

function normalizeLineEndingsAndBom(raw: string): string {
  return raw
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
}

function stripGutenbergBoilerplate(raw: string): string {
  const startMatch =
    raw.match(/\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n*]*(?:\*\*\*)?/i) ??
    raw.match(/START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*/i)
  const endMatch =
    raw.match(/\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK/i) ??
    raw.match(/END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK/i)

  if (startMatch && endMatch && startMatch.index !== undefined && endMatch.index !== undefined) {
    return raw.slice(startMatch.index + startMatch[0].length, endMatch.index).trim()
  }

  return raw.trim()
}

function normalizedLine(line: string): string {
  return line
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^[\s"'([{]+|[\s"')\]}]+$/g, '')
}

function lineWordCount(line: string): number {
  return normalizedLine(line).split(/\s+/).filter(Boolean).length
}

function isBlank(line: string | undefined): boolean {
  return !line || line.trim().length === 0
}

function previousLineIsBlank(lines: string[], idx: number): boolean {
  return idx === 0 || isBlank(lines[idx - 1])
}

function nextLineIsBlank(lines: string[], idx: number): boolean {
  return idx >= lines.length - 1 || isBlank(lines[idx + 1])
}

function nextNonEmptyLineIndex(lines: string[], start: number): number {
  let idx = start
  while (idx < lines.length && isBlank(lines[idx])) {
    idx += 1
  }
  return idx
}

function isMostlyUppercase(line: string): boolean {
  const letters = line.replace(/[^A-Za-z]/g, '')
  if (letters.length < 4) return false
  const upper = letters.replace(/[^A-Z]/g, '').length
  return upper / letters.length >= 0.82
}

function isRomanNumeral(value: string): boolean {
  return /^(?=[MDCLXVI])M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})\.?$/i.test(value)
}

function isNumberWord(value: string): boolean {
  return /^(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth)$/i.test(
    value,
  )
}

function isOrdinalMarker(value: string): boolean {
  const trimmed = value.replace(/[.)]+$/g, '')
  return /^\d{1,3}$/.test(trimmed) || isRomanNumeral(trimmed) || isNumberWord(trimmed)
}

function looksLikeTocEntry(line: string): boolean {
  const t = normalizedLine(line)
  return /\.{3,}\s*\d{1,4}$/.test(t) || /\s{3,}\d{1,4}$/.test(line.trim())
}

function isRejectableHeading(line: string): boolean {
  const t = normalizedLine(line)
  if (!t || t.length > 140) return true
  if (/^[_=*~\- ]{3,}$/.test(t)) return true
  if (/^(?:title|author|language|contents|table of contents|illustrations?|copyright|preface|introduction)$/i.test(t)) {
    return true
  }
  if (/^\[?(?:illustration|transcriber'?s note|note)\]?$/i.test(t)) return true
  if (looksLikeTocEntry(t)) return true
  return false
}

function cleanHeadingForTitle(line: string): string {
  return normalizedLine(line).replace(/\]+$/g, '').trim()
}

function paragraphsFromBlock(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
}

function explicitHeadingConfidence(line: string): number {
  const t = cleanHeadingForTitle(line)
  if (isRejectableHeading(t)) return 0

  if (/^chapter(?:\s+(?:the\s+)?)?[\divxlcdm]+(?:[.)])?(?:\s+.*)?$/i.test(t)) return 100
  if (/^chapter(?:\s+(?:the\s+)?)?[a-z-]+(?:[.)])?(?:\s+.*)?$/i.test(t)) return 96
  if (/^chap\.\s+[\divxlcdm]+(?:[.)])?(?:\s+.*)?$/i.test(t)) return 92
  if (/^(?:book|part|volume|vol\.|letter|stave)\s+(?:the\s+)?[\divxlcdm]+(?:[.)])?(?:\s+.*)?$/i.test(t)) {
    return 86
  }
  if (/^(?:book|part|volume|vol\.|letter|stave)\s+(?:the\s+)?[a-z-]+(?:[.)])?(?:\s+.*)?$/i.test(t)) {
    return 84
  }

  const [firstWord] = t.split(/\s+/)
  if (firstWord && isOrdinalMarker(firstWord) && /^[\divxlcdm]+[.)]?\s+\S+/i.test(t)) return 74
  if (/^\d{1,3}[.)]\s+\S+/.test(t)) return 74
  if (isOrdinalMarker(t)) return 70

  return 0
}

function allCapsTitleConfidence(line: string): number {
  const t = cleanHeadingForTitle(line)
  if (isRejectableHeading(t)) return 0
  if (!isMostlyUppercase(t)) return 0
  if (/[.!?]$/.test(t)) return 0
  const words = lineWordCount(t)
  if (words < 2 || words > 14) return 0
  return 58
}

function isPossibleSubtitle(line: string): boolean {
  const t = cleanHeadingForTitle(line)
  if (isRejectableHeading(t)) return false
  if (explicitHeadingConfidence(t) > 0) return false
  const words = lineWordCount(t)
  if (words === 0 || words > 16 || t.length > 120) return false
  if (/[.!?]$/.test(t) && !isMostlyUppercase(t)) return false
  return true
}

function titleAndBodyStart(lines: string[], headingIdx: number): { title: string; bodyStartLineIndex: number } {
  const titleLines = [cleanHeadingForTitle(lines[headingIdx] ?? '')]
  let cursor = headingIdx + 1

  cursor = nextNonEmptyLineIndex(lines, cursor)
  if (cursor < lines.length && isPossibleSubtitle(lines[cursor] ?? '') && nextLineIsBlank(lines, cursor)) {
    titleLines.push(cleanHeadingForTitle(lines[cursor] ?? ''))
    cursor += 1
  }

  cursor = nextNonEmptyLineIndex(lines, cursor)

  return {
    title: cleanHeadingForTitle(titleLines.filter(Boolean).join(' - ')),
    bodyStartLineIndex: cursor,
  }
}

function collectChapterCandidates(lines: string[]): ChapterCandidate[] {
  const candidates: ChapterCandidate[] = []

  for (let idx = 0; idx < lines.length; idx += 1) {
    const rawLine = lines[idx] ?? ''
    const line = cleanHeadingForTitle(rawLine)
    if (!line || !previousLineIsBlank(lines, idx)) continue

    let confidence = explicitHeadingConfidence(line)
    if (confidence === 0 && nextLineIsBlank(lines, idx)) {
      confidence = allCapsTitleConfidence(line)
    }
    if (confidence === 0) continue

    const { title, bodyStartLineIndex } = titleAndBodyStart(lines, idx)
    candidates.push({
      lineIndex: idx,
      bodyStartLineIndex,
      title,
      confidence,
    })
  }

  return candidates
}

function candidateSegmentText(lines: string[], candidate: ChapterCandidate, nextCandidate?: ChapterCandidate): string {
  return lines.slice(candidate.bodyStartLineIndex, nextCandidate?.lineIndex ?? lines.length).join('\n').trim()
}

function hasEnoughBodyForChapter(segment: string): boolean {
  if (wordCount(segment) >= MIN_CHAPTER_WORDS) return true
  if (segment.length >= MIN_CHAPTER_CHARS && paragraphsFromBlock(segment).length >= 2) return true
  return false
}

function filterChapterCandidates(lines: string[], candidates: ChapterCandidate[]): ChapterCandidate[] {
  const withBody = candidates.filter((candidate, idx) => {
    const segment = candidateSegmentText(lines, candidate, candidates[idx + 1])
    return hasEnoughBodyForChapter(segment)
  })

  if (withBody.length >= 2) {
    return withBody
  }

  const highConfidence = candidates.filter((candidate, idx) => {
    const segment = candidateSegmentText(lines, candidate, candidates[idx + 1])
    return candidate.confidence >= 84 && segment.length >= 200
  })

  return highConfidence.length >= 2 ? highConfidence : withBody
}

function fallbackSingleChapter(body: string): ParsedChapter[] {
  const paras = paragraphsFromBlock(body)
  return [{ title: 'Chapter 1', paragraphs: paras.length ? paras : [body.slice(0, 8000)] }]
}

/** Split plain text into chapters using common Project Gutenberg novel heading patterns. */
export function parsePlainTextIntoChapters(raw: string): ParsedChapter[] {
  const body = stripGutenbergBoilerplate(normalizeLineEndingsAndBom(raw))
  const lines = body.split('\n')
  const candidates = filterChapterCandidates(lines, collectChapterCandidates(lines))

  if (candidates.length === 0) {
    return fallbackSingleChapter(body)
  }

  if (candidates.length === 1) {
    const segment = candidateSegmentText(lines, candidates[0])
    if (!hasEnoughBodyForChapter(segment)) {
      return fallbackSingleChapter(body)
    }
  }

  return candidates.map((candidate, idx) => {
    const segment = candidateSegmentText(lines, candidate, candidates[idx + 1])
    const paras = paragraphsFromBlock(segment)
    const title = (candidate.title || `Chapter ${idx + 1}`).slice(0, 220)

    return {
      title: title || `Chapter ${idx + 1}`,
      paragraphs: paras.length ? paras : [segment.slice(0, 4000)],
    }
  })
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

export function paragraphCount(text: string): number {
  return text.split(/\n{2,}/).length
}