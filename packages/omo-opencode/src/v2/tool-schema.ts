import { z } from "zod"

import { log } from "../shared/logger"

const LOOSE_OBJECT_SCHEMA = {
  type: "object",
  additionalProperties: true,
} as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isZodSchema(value: unknown): boolean {
  return isRecord(value) && isRecord(value._zod)
}

function isZodShape(value: unknown): value is Record<string, z.ZodType> {
  if (!isRecord(value) || isZodSchema(value)) return false
  const fields = Object.values(value)
  return fields.length > 0 && fields.every(isZodSchema)
}

function isJsonSchema(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && (value.type === "object" || Array.isArray(value.type) || value.properties !== undefined)
}

type ZodLike = { _zod: { def: Record<string, unknown> }; description?: unknown }

function asZod(value: unknown): ZodLike | undefined {
  return isZodSchema(value) ? (value as ZodLike) : undefined
}

// Reads the zod v4 definition directly. Inside the OpenCode V2 runtime
// zod's own toJSONSchema throws on the schemas V1 tools were built with
// ("seen.ref"), which left every OMO tool with an untyped parameter list.
function defToJsonSchema(schema: ZodLike): { json: Record<string, unknown>; optional: boolean } {
  const def = schema._zod.def
  const described = (json: Record<string, unknown>) =>
    typeof schema.description === "string" ? { description: schema.description, ...json } : json
  const inner = (key: string) => {
    const nested = asZod(def[key])
    return nested ? defToJsonSchema(nested) : { json: {}, optional: false }
  }
  switch (def.type) {
    case "optional":
    case "default":
    case "prefault": {
      const wrapped = inner("innerType")
      return { json: described(wrapped.json), optional: true }
    }
    case "nullable":
    case "readonly":
    case "catch":
    case "nonoptional": {
      const wrapped = inner("innerType")
      return { json: described(wrapped.json), optional: def.type !== "nonoptional" && wrapped.optional }
    }
    case "string":
    case "number":
    case "boolean":
      return { json: described({ type: def.type }), optional: false }
    case "int":
      return { json: described({ type: "integer" }), optional: false }
    case "array":
      return { json: described({ type: "array", items: inner("element").json }), optional: false }
    case "enum":
      return { json: described({ type: "string", enum: Object.values(isRecord(def.entries) ? def.entries : {}) }), optional: false }
    case "literal":
      return { json: described({ enum: Array.isArray(def.values) ? def.values : [] }), optional: false }
    case "union":
      return {
        json: described({ anyOf: (Array.isArray(def.options) ? def.options : []).flatMap((option) => { const nested = asZod(option); return nested ? [defToJsonSchema(nested).json] : [] }) }),
        optional: false,
      }
    case "record":
      return { json: described({ type: "object", additionalProperties: inner("valueType").json }), optional: false }
    case "object":
      return { json: described(shapeToJsonSchema(isRecord(def.shape) ? def.shape : {})), optional: false }
    default:
      return { json: described({}), optional: false }
  }
}

export function shapeToJsonSchema(shape: Record<string, unknown>): Record<string, unknown> {
  const properties: Record<string, unknown> = {}
  const required: string[] = []
  for (const [key, value] of Object.entries(shape)) {
    const field = asZod(value)
    if (!field) continue
    const converted = defToJsonSchema(field)
    properties[key] = converted.json
    if (!converted.optional) required.push(key)
  }
  return { type: "object", properties, ...(required.length > 0 ? { required } : {}), additionalProperties: false }
}

function convert(args: unknown): Record<string, unknown> | undefined {
  try {
    const { $schema: _dialect, ...schema } = z.toJSONSchema((isZodShape(args) ? z.object(args) : args) as never)
    if (isJsonSchema(schema)) return schema
  } catch (error) {
    log("[oh-my-openagent] zod JSON Schema conversion failed; reading the definition", {
      error: error instanceof Error ? error.message : String(error),
    })
  }
  if (isZodShape(args)) return shapeToJsonSchema(args)
  const zod = asZod(args)
  if (zod?._zod.def.type === "object") return defToJsonSchema(zod).json
  return undefined
}

export function toolInputSchema(tool: { args?: unknown; parameters?: unknown; input?: unknown }): Record<string, unknown> {
  if (isJsonSchema(tool.input)) return tool.input
  if (isJsonSchema(tool.parameters)) return tool.parameters
  if (!tool.args) return { ...LOOSE_OBJECT_SCHEMA }
  return convert(tool.args) ?? { ...LOOSE_OBJECT_SCHEMA }
}

/**
 * OpenCode V2 validates tool metadata as JSON when it records the result. A
 * V1 field left `undefined` (the task tool's `command`, a model's `variant`)
 * fails that check after the call is already marked settled, so the call stays
 * "running" forever and the next request is rejected for a missing tool_result.
 */
export function jsonMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  try {
    const plain: unknown = JSON.parse(JSON.stringify(metadata))
    return isRecord(plain) && !Array.isArray(plain) ? plain : {}
  } catch (error) {
    log("[oh-my-openagent] dropped tool metadata that is not JSON", {
      error: error instanceof Error ? error.message : String(error),
    })
    return {}
  }
}

export function toolResult(result: unknown): { content: string; metadata?: Record<string, unknown> } {
  if (typeof result === "string") return { content: result }
  if (!isRecord(result)) return { content: result == null ? "" : String(result) }
  const metadata = isRecord(result.metadata) ? jsonMetadata(result.metadata) : undefined
  if (typeof result.content === "string") return { content: result.content, ...(metadata ? { metadata } : {}) }
  if (typeof result.output === "string") return { content: result.output, ...(metadata ? { metadata } : {}) }
  return { content: JSON.stringify(result), ...(metadata ? { metadata } : {}) }
}
