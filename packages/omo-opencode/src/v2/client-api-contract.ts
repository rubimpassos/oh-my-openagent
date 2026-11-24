import { z } from "zod"

const identifier = z.string().min(1).max(256)
const sessionID = z.string().regex(/^[A-Za-z0-9_-]{1,256}$/)
const timestamp = z.number().finite().nonnegative()
const count = z.number().int().nonnegative()
const surface = z.enum(["terminal", "chat"])

export const ClientAttachmentSchema = z.object({
  instanceID: identifier,
  generation: identifier,
}).strict()
export type ClientAttachment = z.infer<typeof ClientAttachmentSchema>

export const ClientGoalSchema = z.object({
  id: identifier,
  sessionID,
  objective: z.string(),
  status: z.enum(["active", "paused", "complete", "blocked", "budgetLimited"]),
  tokensUsed: count,
  tokenBudget: z.number().int().positive().optional(),
  turnsUsed: count,
  timeUsedSeconds: timestamp,
  createdAt: timestamp,
  updatedAt: timestamp,
  completedAt: timestamp.optional(),
})
export type ClientApiGoal = z.infer<typeof ClientGoalSchema>

const attempt = z.object({
  number: count,
  status: z.string(),
  sessionID: z.string().optional(),
  model: z.string().optional(),
  error: z.string().optional(),
  startedAt: timestamp.optional(),
  completedAt: timestamp.optional(),
})
const task = z.object({
  id: identifier,
  description: z.string(),
  agent: z.string(),
  status: z.string(),
  sessionID: z.string().optional(),
  category: z.string().optional(),
  startedAt: timestamp.optional(),
  completedAt: timestamp.optional(),
  error: z.string().optional(),
  toolCalls: count.optional(),
  lastTool: z.string().optional(),
  model: z.string().optional(),
  attempts: z.array(attempt).optional(),
})
const plan = z.object({
  workId: z.string(),
  planName: z.string(),
  planPath: z.string(),
  status: z.string(),
  total: count,
  completed: count,
  nextTask: z.string().optional(),
  startedAt: timestamp.optional(),
  tasks: z.array(z.object({
    key: z.string(), label: z.string(), title: z.string(), status: z.string(),
    sessionID: z.string(), agent: z.string().optional(), category: z.string().optional(),
  })),
})
const team = z.object({
  teamRunId: z.string(), teamName: z.string(), status: z.string(),
  members: z.array(z.object({
    name: z.string(), sessionID: z.string().optional(), status: z.string(),
    agentType: z.string(), unread: count.optional(),
  })),
})
export const ClientApiStateSchema = z.object({
  instanceID: identifier,
  revision: count,
  directory: z.string(),
  tasks: z.record(z.string(), z.array(task)),
  goals: z.record(z.string(), ClientGoalSchema),
  plans: z.record(z.string(), plan),
  teams: z.record(z.string(), z.array(team)),
  health: z.object({
    categories: z.record(z.string(), z.array(z.string())),
    providers: z.array(z.object({
      provider: z.string(), failures: count, lastError: z.string(),
      lastModel: z.string(), lastAt: timestamp,
    })),
  }),
})
export type ClientApiState = z.infer<typeof ClientApiStateSchema>

const failure = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.enum(["unsupported", "not_found", "goal_changed", "wrong_location", "client_conflict", "stale_attachment"]),
    message: z.string(),
  }),
})
export type ClientApiFailure = z.infer<typeof failure>
const attachmentInput = { attachment: ClientAttachmentSchema.optional() }

export const ClientGoalControlSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("clear"), sessionID, expectedGoalID: identifier, ...attachmentInput,
  }).strict(),
  z.object({
    action: z.literal("update"), sessionID, expectedGoalID: identifier,
    objective: z.string().trim().min(1).max(2000).optional(),
    tokenBudget: z.number().int().positive().nullable().optional(),
    status: z.enum(["active", "paused", "complete"]).optional(),
    ...attachmentInput,
  }).strict().refine((value) => value.objective !== undefined || value.tokenBudget !== undefined || value.status !== undefined, {
    message: "An update requires an objective, budget or status.",
  }),
])
export type ClientGoalControl = z.infer<typeof ClientGoalControlSchema>
const goalResult = z.union([
  z.object({ ok: z.literal(true), goal: ClientGoalSchema.nullable() }),
  failure,
])
export type ClientGoalControlResult = z.infer<typeof goalResult>
const taskInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cancel"), taskId: identifier, ...attachmentInput }).strict(),
  z.object({
    action: z.literal("retry"), taskId: identifier, ...attachmentInput,
    model: z.string().regex(/^[^/\s]+\/\S+$/).max(200).optional(),
  }).strict(),
])
const invalidation = z.object({ instanceID: identifier, revision: count })
const presentation = z.object({ surface }).strict()
const empty = z.object({}).strict()

/** Portable Standard Schema definition: consumers bundle this file without the engine. */
export const clientRpc = {
  id: "omo.client.v1",
  methods: {
    describe: {
      input: empty,
      output: z.object({
        version: z.literal(1), instanceID: identifier, directory: z.string(),
        capabilities: z.object({ goals: z.boolean(), tasks: z.boolean(), presentation: z.literal(true) }),
        client: z.object({
          clientID: identifier, attachment: ClientAttachmentSchema, presentation,
        }).nullable(),
      }),
    },
    getState: {
      input: z.object({ sessionID: sessionID.optional() }).strict(),
      output: ClientApiStateSchema,
    },
    controlGoal: { input: ClientGoalControlSchema, output: goalResult },
    controlTask: {
      input: taskInput,
      output: z.union([z.object({ ok: z.literal(true), message: z.string() }), failure]),
    },
    attach: {
      input: z.object({
        instanceID: identifier, clientID: identifier,
        callbackRPCID: z.string().regex(/^[A-Za-z0-9._-]{1,128}$/), presentation,
      }).strict(),
      output: z.union([z.object({ ok: z.literal(true), attachment: ClientAttachmentSchema }), failure]),
    },
    detach: {
      input: ClientAttachmentSchema,
      output: z.object({ detached: z.boolean() }),
    },
  },
  events: { ready: { schema: invalidation }, stateChanged: { schema: invalidation } },
} as const

export const continuationRpc = (id: string) => ({
  id,
  methods: {
    beforeGoalContinuation: {
      input: z.object({
        attachment: ClientAttachmentSchema, sessionID, expectedGoalID: identifier,
      }).strict(),
      output: z.object({ synchronized: z.literal(true) }),
    },
  },
  events: {},
} as const)
