import { z } from "zod"

// `blocked` (continuation cap reached) and `budgetLimited` (token budget spent)
// are settled like `complete` but resumable; they match OpenChamber's goal
// statuses so a mirrored goal reads the same in both.
export const GOAL_STATUS_VALUES = ["active", "paused", "complete", "blocked", "budgetLimited"] as const

export const GoalStatusSchema = z.enum(GOAL_STATUS_VALUES)
export type GoalStatus = z.infer<typeof GoalStatusSchema>

export const GoalSchema = z.object({
  id: z.string(),
  sessionID: z.string(),
  objective: z.string(),
  status: GoalStatusSchema,
  tokensUsed: z.number().int().nonnegative(),
  timeUsedSeconds: z.number().int().nonnegative(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  lastStartedAt: z.number().int().nonnegative().optional(),
  completedAt: z.number().int().nonnegative().optional(),
  /** Stop once `tokensUsed` reaches this; absent means no budget. */
  tokenBudget: z.number().int().positive().optional(),
  /** Continuations sent since the goal started or was last resumed. */
  turnsUsed: z.number().int().nonnegative().default(0),
})

export type Goal = z.infer<typeof GoalSchema>

export const GoalFileSchema = z.object({
  version: z.literal(1),
  goal: GoalSchema.nullable(),
})

export type GoalFile = z.infer<typeof GoalFileSchema>

export type GoalStoreRef = {
  readonly baseDir: string
  readonly sessionID: string
}

export type TokenUsageSnapshot = {
  readonly input: number
  readonly output: number
  readonly cacheRead: number
  readonly cacheWrite: number
  readonly totalTokens: number
}

export type GoalUpdate = {
  readonly objective?: string
  readonly status?: GoalStatus
  readonly tokensUsed?: number
  readonly timeUsedSeconds?: number
  /** `null` removes the budget. */
  readonly tokenBudget?: number | null
  readonly turnsUsed?: number
}

export const GoalToolSnapshotSchema = z.object({
  sessionID: z.string(),
  objective: z.string(),
  status: GoalStatusSchema,
  tokensUsed: z.number().int().nonnegative(),
  timeUsedSeconds: z.number().int().nonnegative(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
})

export type GoalToolSnapshot = z.infer<typeof GoalToolSnapshotSchema>

export const GoalToolResponseSchema = z.object({
  goal: GoalToolSnapshotSchema.nullable(),
})

export type GoalToolResponse = z.infer<typeof GoalToolResponseSchema>

export type GoalAccountingMode = "active" | "activeOrComplete"
