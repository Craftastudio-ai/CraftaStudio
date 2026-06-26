// CraftaStudio — src/middleware/validateBlockType.ts
import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify'

const BLOCK_TYPES = ['data', 'api', 'ui', 'service', 'integration', 'auth', 'job'] as const
type BlockType = (typeof BLOCK_TYPES)[number]

/**
 * Middleware — validates that `blockType` in the request body is a known BlockType.
 *
 * Use as a preHandler hook on POST/PATCH block routes:
 *   app.post('/', { preHandler: [validateBlockType] }, handler)
 */
export function validateBlockType(
  req: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction,
): void {
  const body = req.body as Record<string, unknown>

  if (!body || typeof body['blockType'] !== 'string') {
    reply.code(422).send({ error: 'blockType is required and must be a string' })
    return
  }

  const blockType = body['blockType'] as string
  const isValid = (BLOCK_TYPES as readonly string[]).includes(blockType)

  if (!isValid) {
    reply.code(422).send({
      error: `Invalid blockType "${blockType}". Must be one of: ${BLOCK_TYPES.join(', ')}`,
    })
    return
  }

  // Block type is valid — cast and attach to request for downstream handlers
  ;(req as FastifyRequest & { blockType: BlockType }).blockType = blockType as BlockType

  done()
}
