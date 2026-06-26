import { z } from "zod";

export const BlockTypeSchema = z.enum(["service", "database", "api", "ui", "job"]);

export const InputOutputSchema = z.object({
  name: z.string(),
  type: z.string(),
  source: z.string().optional().nullable(),
  destination: z.string().optional().nullable(),
});

export const ApiEndpointSchema = z.object({
  method: z.string(),
  route: z.string(),
  request: z.record(z.string(), z.any()).default({}),
  response: z.record(z.string(), z.any()).default({}),
});

export const ApiSpecSchema = z.object({
  endpoints: z.array(ApiEndpointSchema),
});

export const FileInfoSchema = z.object({
  path: z.string(),
  description: z.string(),
});

export const CodeGenerationPlanSchema = z.object({
  files: z.array(FileInfoSchema),
  stack: z.string(),
});

export const ExecutionConstraintsSchema = z.object({
  retry_limit: z.number().default(3),
  timeout_ms: z.number().default(60000),
  idempotent: z.boolean().default(true),
});

export const PreviewBehaviorSchema = z.object({
  ui_render: z.string(),
  interactions: z.array(z.string()).default([]),
});

export const BlockDocumentSchema = z.object({
  block_id: z.string(),
  block_name: z.string(),
  block_type: BlockTypeSchema,
  purpose: z.string(),
  inputs: z.array(InputOutputSchema).default([]),
  outputs: z.array(InputOutputSchema).default([]),
  dependencies: z.array(z.string()).default([]),
  api_spec: ApiSpecSchema.optional().nullable(),
  internal_logic: z.array(z.string()).default([]),
  code_generation_plan: CodeGenerationPlanSchema,
  execution_constraints: ExecutionConstraintsSchema.default({
    retry_limit: 3,
    timeout_ms: 60000,
    idempotent: true
  }),
  preview_behavior: PreviewBehaviorSchema.optional().nullable(),
  block_version: z.string().default("1.0.0"),
});

export const GraphEdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
});

export const GraphSchema = z.object({
  nodes: z.array(z.string()),
  edges: z.array(GraphEdgeSchema),
});

export const SystemDocumentationSchema = z.object({
  title: z.string(),
  summary: z.string(),
  markdown: z.string(),
});

export const PlanResponseSchema = z.object({
  executionId: z.string(),
  schema_version: z.string().default("1.0.0"),
  documentation: SystemDocumentationSchema,
  blocks: z.array(BlockDocumentSchema),
  graph: GraphSchema,
});

export type BlockDocument = z.infer<typeof BlockDocumentSchema>;
export type PlanResponse = z.infer<typeof PlanResponseSchema>;
export type BlockType = z.infer<typeof BlockTypeSchema>;
