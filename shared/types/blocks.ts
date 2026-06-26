// CraftaStudio — shared/types/blocks.ts
// ─────────────────────────────────────────────────────────────
// SHARED BLOCK TYPES — DO NOT MODIFY WITHOUT TEAM DISCUSSION
// This file is the contract between frontend, backend, and agents
// ─────────────────────────────────────────────────────────────

export const BLOCK_TYPES = [
  'data',
  'api',
  'ui',
  'service',
  'integration',
  'auth',
  'job',
] as const

export type BlockType = (typeof BLOCK_TYPES)[number]

export interface BlockField {
  name: string
  type: 'uuid' | 'string' | 'int' | 'boolean' | 'datetime' | 'float'
  primary?: boolean
  unique?: boolean
  nullable?: boolean
}

export interface Block {
  id: string
  type: BlockType
  name: string
  schema: {
    fields: BlockField[]
  }
  connections: string[]
  generatedFiles: string[]
  version: string
  metadata: {
    createdAt: string
    updatedAt: string
  }
}

export interface SharedContext {
  project: string
  entities: Record<string, { fields: BlockField[] }>
  api_routes: Record<string, string>
  tech_stack: {
    backend: string
    frontend: string
    db: string
    auth: string
  }
  conventions: {
    casing: 'camelCase' | 'snake_case'
    auth: string
    errors: string
    responses: string
  }
}
