/**
 * split-words.ts
 *
 * Splits a single Bayana word export into per-level JSON files
 * and strips noisy JLPT_* tags from each word.
 *
 * Usage:
 *   npx tsx scripts/split-words.ts <input-file> <output-dir>
 *
 * Example:
 *   npx tsx scripts/split-words.ts exports/all.json app/assets/words
 *
 * Output:
 *   app/assets/words/n5.json
 *   app/assets/words/n4.json
 *   app/assets/words/n3.json
 *   app/assets/words/n2.json
 *   app/assets/words/n1.json
 */

import fs from 'fs'
import path from 'path'

// --- Types (mirrors Kalima's types/index.ts) ---

type Level = 'N5' | 'N4' | 'N3' | 'N2' | 'N1'

interface Word {
    id: string
    guid: string
    expression: string
    reading: string
    meaning: string
    level: Level
    tags: string[]
    exampleSentence?: {
        japanese: string
        reading: string
        english: string
    }
}

// --- Config ---

const LEVELS: Level[] = ['N5', 'N4', 'N3', 'N2', 'N1']

// Tags matching this pattern will be stripped
const JLPT_TAG_PATTERN = /^JLPT/i

// --- Main ---

function stripJlptTags(tags: string[]): string[] {
    return tags.filter(tag => !JLPT_TAG_PATTERN.test(tag))
}

function cleanWord(word: Word): Word {
    return {
        ...word,
        tags: stripJlptTags(word.tags),
    }
}

function splitByLevel(words: Word[]): Record<Level, Word[]> {
    const result = Object.fromEntries(LEVELS.map(l => [l, []])) as Record<Level, Word[]>
    for (const word of words) {
        if (!LEVELS.includes(word.level)) {
            console.warn(`⚠️  Unknown level "${word.level}" for word "${word.expression}" — skipping`)
            continue
        }
        result[word.level].push(cleanWord(word))
    }
    return result
}

function main() {
    const [, , inputFile, outputDir] = process.argv

    if (!inputFile || !outputDir) {
        console.error('Usage: npx tsx scripts/split-words.ts <input-file> <output-dir>')
        process.exit(1)
    }

    const inputPath = path.resolve(inputFile)
    const outputPath = path.resolve(outputDir)

    if (!fs.existsSync(inputPath)) {
        console.error(`❌ Input file not found: ${inputPath}`)
        process.exit(1)
    }

    fs.mkdirSync(outputPath, { recursive: true })

    console.log(`📖 Reading ${inputPath}...`)
    const raw = fs.readFileSync(inputPath, 'utf-8')
    const words: Word[] = JSON.parse(raw)
    console.log(`   ${words.length} words loaded`)

    const byLevel = splitByLevel(words)

    for (const level of LEVELS) {
        const filename = `${level.toLowerCase()}.json`
        const filePath = path.join(outputPath, filename)
        const levelWords = byLevel[level]
        fs.writeFileSync(filePath, JSON.stringify(levelWords, null, 2), 'utf-8')
        console.log(`✅ ${filename} — ${levelWords.length} words`)
    }

    const total = LEVELS.reduce((sum, l) => sum + byLevel[l].length, 0)
    console.log(`\n🎉 Done. ${total} words written across ${LEVELS.length} files → ${outputPath}`)
}

main()