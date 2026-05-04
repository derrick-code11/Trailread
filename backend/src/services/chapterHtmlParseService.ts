import * as cheerio from 'cheerio'
import type { ParsedChapter } from './chapterParseService.js'
import { wordCount } from './chapterParseService.js'

type HtmlBlock = {
  tag: string
  text: string
  classes: string
  id: string
}

type ChapterStart = {
  blockIndex: number
  title: string
  confidence: number
}

const MIN_HTML_CHAPTERS = 2
const MIN_HTML_CHAPTER_WORDS = 40

function normalizeText(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isMostlyUppercase(text: string): boolean {
  const letters = text.replace(/[^A-Za-z]/g, '')
  if (letters.length < 4) return false
  const upper = letters.replace(/[^A-Z]/g, '').length
  return upper / letters.length >= 0.82
}

function isRomanNumeral(value: string): boolean {
  return /^(?=[MDCLXVI])M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})\.?$/i.test(value)
}

function isNumberWord(value: string): boolean {
  return /^(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth)$/i.test(
    value,
  )
}

function isOrdinal(value: string): boolean {
  const trimmed = value.replace(/[.)]+$/g, '')
  return /^\d{1,3}$/.test(trimmed) || isRomanNumeral(trimmed) || isNumberWord(trimmed)
}

function looksLikeTocText(text: string): boolean {
  return /\.{3,}\s*\d{1,4}$/.test(text) || /\s{3,}\d{1,4}$/.test(text)
}

function rejectHeadingText(text: string): boolean {
  if (!text || text.length > 160) return true
  if (/^[_=*~\- ]{3,}$/.test(text)) return true
  if (/^(?:contents|table of contents|illustrations?|title page|copyright|preface|introduction)$/i.test(text)) {
    return true
  }
  if (/^\[?(?:illustration|transcriber'?s note|note)\]?$/i.test(text)) return true
  if (looksLikeTocText(text)) return true
  return false
}

function embeddedStructuralHeading(text: string): string | null {
  const normalized = normalizeText(text)
  const match = normalized.match(
    /\b(?:CHAPTER\s*[IVXLCDM\d]+\.?|CHAPTER\s+[A-Z][A-Z-]+\.?|Chapter\s*[IVXLCDM\d]+\.?|Chapter\s+[A-Z][a-z-]+\.?|(?:BOOK|PART|VOLUME|LETTER|STAVE|CANTO)\s+(?:the\s+)?[IVXLCDM\d]+\.?)\b/u,
  )
  return match ? normalizeText(match[0]) : null
}

function headingConfidence(block: HtmlBlock): number {
  const text = embeddedStructuralHeading(block.text) ?? normalizeText(block.text)
  if (rejectHeadingText(text)) return 0

  const isHeadingTag = /^h[1-5]$/i.test(block.tag)
  const marker = `${block.id} ${block.classes}`.toLowerCase()
  const hasChapterClass = /\b(?:chapter|section|book|part)\b/.test(marker)

  if (/^chapter(?:\s+(?:the\s+)?)?[\divxlcdm]+(?:[.)])?(?:\s+.*)?$/i.test(text)) return 100
  if (/^chapter(?:\s+(?:the\s+)?)?[a-z-]+(?:[.)])?(?:\s+.*)?$/i.test(text)) return 96
  if (/^(?:book|part|volume|vol\.|letter|stave|canto)\s+(?:the\s+)?[\divxlcdm]+(?:[.)])?(?:\s+.*)?$/i.test(text)) {
    return 90
  }
  if (/^(?:book|part|volume|vol\.|stave|canto)\s+(?:the\s+)?[a-z-]+(?:[.)])?(?:\s+.*)?$/i.test(text)) {
    return 88
  }

  const [firstWord] = text.split(/\s+/)
  const words = text.split(/\s+/).filter(Boolean).length
  if (isHeadingTag || hasChapterClass) {
    if (firstWord && words <= 12 && isOrdinal(firstWord) && /^[ivxlcdm]+[.)]\s+\S+/i.test(text)) return 78
    if (words <= 12 && /^\d{1,3}[.)]\s+\S+/.test(text)) return 78
  }
  if (isOrdinal(text) && (isHeadingTag || hasChapterClass)) return 76

  if ((isHeadingTag || hasChapterClass) && isMostlyUppercase(text) && words >= 2 && words <= 14 && !/[.!?]$/.test(text)) {
    return hasChapterClass ? 72 : 64
  }

  if (hasChapterClass && words >= 1 && words <= 16) return 62

  return 0
}

function cleanTitle(text: string): string {
  return normalizeText(embeddedStructuralHeading(text) ?? text).replace(/\]+$/g, '').slice(0, 220)
}

function isParagraphBlock(block: HtmlBlock): boolean {
  if (!block.text) return false
  if (/^h[1-5]$/i.test(block.tag)) return false
  if (headingConfidence(block) >= 76) return false
  if (looksLikeTocText(block.text) && wordCount(block.text) < 20) return false
  if (wordCount(block.text) < 2) return false
  return true
}

function likelyNoiseSelector(): string {
  return [
    'script',
    'style',
    'nav',
    'table',
    'thead',
    'tfoot',
    '.toc',
    '#toc',
    '.contents',
    '#contents',
    '.footnote',
    '.footnotes',
    '#footnotes',
    '.pg-boilerplate',
    '.transnote',
    '.tnote',
  ].join(',')
}

function collectBlocks(html: string): HtmlBlock[] {
  const $ = cheerio.load(html)
  $(likelyNoiseSelector()).remove()

  const root = $('body').length > 0 ? $('body') : $('html')
  const blocks: HtmlBlock[] = []

  root.find('h1,h2,h3,h4,h5,p,li').each((_idx, el) => {
    const $el = $(el)
    const text = normalizeText($el.text())
    if (!text) return

    blocks.push({
      tag: String(el.tagName ?? '').toLowerCase(),
      text,
      classes: String($el.attr('class') ?? ''),
      id: String($el.attr('id') ?? ''),
    })
  })

  return blocks
}

function collectChapterStarts(blocks: HtmlBlock[]): ChapterStart[] {
  const starts: ChapterStart[] = []

  for (let idx = 0; idx < blocks.length; idx += 1) {
    const block = blocks[idx]!
    const confidence = headingConfidence(block)
    if (confidence === 0) continue

    starts.push({
      blockIndex: idx,
      title: cleanTitle(block.text),
      confidence,
    })
  }

  return starts
}

function paragraphsBetween(blocks: HtmlBlock[], start: ChapterStart, next?: ChapterStart): string[] {
  const slice = blocks.slice(start.blockIndex + 1, next?.blockIndex ?? blocks.length)
  return slice.filter(isParagraphBlock).map((block) => cleanTitle(block.text))
}

function filterStartsWithBody(blocks: HtmlBlock[], starts: ChapterStart[]): ChapterStart[] {
  const structuralStartIndex = starts.findIndex((start) => start.confidence >= 76)
  const scopedStarts =
    structuralStartIndex > 0 && starts.filter((start) => start.confidence >= 76).length >= MIN_HTML_CHAPTERS
      ? starts.slice(structuralStartIndex)
      : starts

  const withBody = scopedStarts.filter((start, idx) => {
    const paragraphs = paragraphsBetween(blocks, start, scopedStarts[idx + 1])
    return wordCount(paragraphs.join(' ')) >= MIN_HTML_CHAPTER_WORDS
  })

  if (withBody.length >= MIN_HTML_CHAPTERS) {
    return withBody
  }

  const highConfidence = scopedStarts.filter((start, idx) => {
    const paragraphs = paragraphsBetween(blocks, start, scopedStarts[idx + 1])
    return start.confidence >= 88 && wordCount(paragraphs.join(' ')) >= 40
  })

  return highConfidence.length >= MIN_HTML_CHAPTERS ? highConfidence : withBody
}

export function parseHtmlIntoChapters(html: string): ParsedChapter[] {
  const blocks = collectBlocks(html)
  if (blocks.length === 0) return []

  const starts = filterStartsWithBody(blocks, collectChapterStarts(blocks))
  if (starts.length < MIN_HTML_CHAPTERS) return []

  return starts
    .map((start, idx) => {
      const paragraphs = paragraphsBetween(blocks, start, starts[idx + 1])
      return {
        title: start.title || `Chapter ${idx + 1}`,
        paragraphs,
      }
    })
    .filter((chapter) => chapter.paragraphs.length > 0)
}
