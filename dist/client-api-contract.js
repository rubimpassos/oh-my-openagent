// packages/omo-opencode/src/v2/client-api-contract.ts
import { z } from "zod";
var identifier = z.string().min(1).max(256);
var sessionID = z.string().regex(/^[A-Za-z0-9_-]{1,256}$/);
var timestamp = z.number().finite().nonnegative();
var count = z.number().int().nonnegative();
var surface = z.enum(["terminal", "chat"]);
var ClientAttachmentSchema = z.object({
  instanceID: identifier,
  generation: identifier
}).strict();
var ClientGoalSchema = z.object({
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
  completedAt: timestamp.optional()
});
var attempt = z.object({
  number: count,
  status: z.string(),
  sessionID: z.string().optional(),
  model: z.string().optional(),
  error: z.string().optional(),
  startedAt: timestamp.optional(),
  completedAt: timestamp.optional()
});
var task = z.object({
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
  attempts: z.array(attempt).optional()
});
var plan = z.object({
  workId: z.string(),
  planName: z.string(),
  planPath: z.string(),
  status: z.string(),
  total: count,
  completed: count,
  nextTask: z.string().optional(),
  startedAt: timestamp.optional(),
  tasks: z.array(z.object({
    key: z.string(),
    label: z.string(),
    title: z.string(),
    status: z.string(),
    sessionID: z.string(),
    agent: z.string().optional(),
    category: z.string().optional()
  }))
});
var team = z.object({
  teamRunId: z.string(),
  teamName: z.string(),
  status: z.string(),
  members: z.array(z.object({
    name: z.string(),
    sessionID: z.string().optional(),
    status: z.string(),
    agentType: z.string(),
    unread: count.optional()
  }))
});
var ClientApiStateSchema = z.object({
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
      provider: z.string(),
      failures: count,
      lastError: z.string(),
      lastModel: z.string(),
      lastAt: timestamp
    }))
  })
});
var failure = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.enum(["unsupported", "not_found", "goal_changed", "wrong_location", "client_conflict", "stale_attachment"]),
    message: z.string()
  })
});
var attachmentInput = { attachment: ClientAttachmentSchema.optional() };
var ClientGoalControlSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("clear"),
    sessionID,
    expectedGoalID: identifier,
    ...attachmentInput
  }).strict(),
  z.object({
    action: z.literal("update"),
    sessionID,
    expectedGoalID: identifier,
    objective: z.string().trim().min(1).max(2000).optional(),
    tokenBudget: z.number().int().positive().nullable().optional(),
    status: z.enum(["active", "paused", "complete"]).optional(),
    ...attachmentInput
  }).strict().refine((value) => value.objective !== undefined || value.tokenBudget !== undefined || value.status !== undefined, {
    message: "An update requires an objective, budget or status."
  })
]);
var goalResult = z.union([
  z.object({ ok: z.literal(true), goal: ClientGoalSchema.nullable() }),
  failure
]);
var taskInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cancel"), taskId: identifier, ...attachmentInput }).strict(),
  z.object({
    action: z.literal("retry"),
    taskId: identifier,
    ...attachmentInput,
    model: z.string().regex(/^[^/\s]+\/\S+$/).max(200).optional()
  }).strict()
]);
var invalidation = z.object({ instanceID: identifier, revision: count });
var presentation = z.object({ surface }).strict();
var empty = z.object({}).strict();
var clientRpc = {
  id: "omo.client.v1",
  methods: {
    describe: {
      input: empty,
      output: z.object({
        version: z.literal(1),
        instanceID: identifier,
        directory: z.string(),
        capabilities: z.object({ goals: z.boolean(), tasks: z.boolean(), presentation: z.literal(true) }),
        client: z.object({
          clientID: identifier,
          attachment: ClientAttachmentSchema,
          presentation
        }).nullable()
      })
    },
    getState: {
      input: z.object({ sessionID: sessionID.optional() }).strict(),
      output: ClientApiStateSchema
    },
    controlGoal: { input: ClientGoalControlSchema, output: goalResult },
    controlTask: {
      input: taskInput,
      output: z.union([z.object({ ok: z.literal(true), message: z.string() }), failure])
    },
    attach: {
      input: z.object({
        instanceID: identifier,
        clientID: identifier,
        callbackRPCID: z.string().regex(/^[A-Za-z0-9._-]{1,128}$/),
        presentation
      }).strict(),
      output: z.union([z.object({ ok: z.literal(true), attachment: ClientAttachmentSchema }), failure])
    },
    detach: {
      input: ClientAttachmentSchema,
      output: z.object({ detached: z.boolean() })
    }
  },
  events: { ready: { schema: invalidation }, stateChanged: { schema: invalidation } }
};
var continuationRpc = (id) => ({
  id,
  methods: {
    beforeGoalContinuation: {
      input: z.object({
        attachment: ClientAttachmentSchema,
        sessionID,
        expectedGoalID: identifier
      }).strict(),
      output: z.object({ synchronized: z.literal(true) })
    }
  },
  events: {}
});
export {
  ClientApiStateSchema,
  ClientAttachmentSchema,
  ClientGoalControlSchema,
  ClientGoalSchema,
  clientRpc,
  continuationRpc
};
