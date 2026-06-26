import { MemoryType, Priority, MemorySource } from '@prisma/client'

export interface ExtractedSignal {
  key: string
  value: unknown
  type: MemoryType
  priority: Priority
  source: MemorySource
}

const NORMALIZATION_MAP: Record<string, string> = {
  pg: 'postgresql', postgres: 'postgresql', mongo: 'mongodb', 'mongo db': 'mongodb',
  ts: 'typescript', js: 'javascript', 'next.js': 'nextjs', next: 'nextjs',
  'nest.js': 'nestjs', nest: 'nestjs', 'clerk auth': 'clerk', 'next auth': 'nextauth',
  jwt: 'jwt', tailwind: 'tailwindcss', 'tailwind css': 'tailwindcss',
}

export function normalizeValue(value: string): string {
  const lower = value.toLowerCase().trim()
  return NORMALIZATION_MAP[lower] ?? lower
}

interface SignalPattern {
  pattern: RegExp
  key: string
  type: MemoryType
  priority: Priority
  extract: (match: RegExpMatchArray) => string
}

// All type/priority values use imported enum objects — never string literals
const SIGNAL_PATTERNS: SignalPattern[] = [
  {
    pattern: /(?:use|using|with|database[:\s]+)\s*(postgresql|postgres|pg|mongodb|mongo|mysql|sqlite|supabase|neon|planetscale)/i,
    key: 'database', type: MemoryType.architecture_decision, priority: Priority.high,
    extract: m => normalizeValue(m[1]),
  },
  {
    pattern: /(?:use|using|auth(?:entication)?[:\s]+)\s*(clerk|jwt|nextauth|auth0|firebase|supabase auth)/i,
    key: 'auth_provider', type: MemoryType.architecture_decision, priority: Priority.high,
    extract: m => normalizeValue(m[1]),
  },
  {
    pattern: /(?:use|using|built with|framework[:\s]+)\s*(next\.?js|react|vue|svelte|fastify|express|nest\.?js)/i,
    key: 'framework', type: MemoryType.architecture_decision, priority: Priority.high,
    extract: m => normalizeValue(m[1]),
  },
  {
    pattern: /(?:language[:\s]+|written in|use)\s*(typescript|javascript|python|ts|js)/i,
    key: 'language', type: MemoryType.preference, priority: Priority.medium,
    extract: m => normalizeValue(m[1]),
  },
  {
    pattern: /(?:use|orm[:\s]+)\s*(prisma|drizzle|typeorm|sequelize|mongoose)/i,
    key: 'orm', type: MemoryType.architecture_decision, priority: Priority.high,
    extract: m => normalizeValue(m[1]),
  },
  {
    pattern: /(?:use|styling[:\s]+|css[:\s]+)\s*(tailwind(?:css)?|styled-components|css modules|scss|sass)/i,
    key: 'styling', type: MemoryType.preference, priority: Priority.medium,
    extract: m => normalizeValue(m[1]),
  },
  {
    pattern: /(?:use|build|create)\s+(rest(?:ful)?|graphql|trpc|grpc)\s+api/i,
    key: 'api_style', type: MemoryType.architecture_decision, priority: Priority.high,
    extract: m => normalizeValue(m[1]),
  },
  {
    pattern: /(?:use|with)\s+(redis|memcached|upstash)\s*(?:for\s+(?:cache|caching|queue))?/i,
    key: 'cache_provider', type: MemoryType.architecture_decision, priority: Priority.medium,
    extract: m => normalizeValue(m[1]),
  },
  {
    pattern: /(?:deploy|host|hosting)\s+(?:on|to|with)\s+(vercel|railway|render|aws|gcp|azure|fly\.io)/i,
    key: 'hosting', type: MemoryType.constraint, priority: Priority.medium,
    extract: m => normalizeValue(m[1]),
  },
  {
    pattern: /(?:use|store files|upload to)\s+(s3|r2|cloudflare r2|supabase storage|uploadthing)/i,
    key: 'file_storage', type: MemoryType.architecture_decision, priority: Priority.medium,
    extract: m => normalizeValue(m[1]),
  },
  {
    pattern: /(?:must be|should be|needs to be)\s+(fast|performant|optimized|lightweight)/i,
    key: 'performance_requirement', type: MemoryType.constraint, priority: Priority.medium,
    extract: m => m[1].toLowerCase(),
  },
  {
    pattern: /(?:mobile[- ]first|responsive design|support mobile)/i,
    key: 'responsive_design', type: MemoryType.constraint, priority: Priority.medium,
    extract: () => 'required',
  },
]

const VAGUE_VALUES = new Set([
  'good', 'better', 'best', 'nice', 'clean', 'simple', 'easy',
  'modern', 'standard', 'default', 'basic', 'advanced',
])

function isActionable(signal: ExtractedSignal): boolean {
  const val = String(signal.value).toLowerCase().trim()
  return val.length >= 2 && !VAGUE_VALUES.has(val)
}

export function extractSignals(
  input: string,
  source: MemorySource = MemorySource.user,
): ExtractedSignal[] {
  const signals: ExtractedSignal[] = []
  const seenKeys = new Set<string>()

  for (const sp of SIGNAL_PATTERNS) {
    const match = input.match(sp.pattern)
    if (match && !seenKeys.has(sp.key)) {
      const signal: ExtractedSignal = {
        key: sp.key,
        value: sp.extract(match),
        type: sp.type,
        priority: sp.priority,
        source,
      }
      if (isActionable(signal)) {
        signals.push(signal)
        seenKeys.add(sp.key)
      }
    }
  }

  return signals
}