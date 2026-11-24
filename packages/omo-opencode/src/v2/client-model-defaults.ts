import {
  AGENT_MODEL_REQUIREMENTS,
  CATEGORY_MODEL_REQUIREMENTS,
  resolveModelPipeline,
  type ModelRequirement,
  type PipelineModelResolutionRequest,
} from "@oh-my-opencode/model-core"

import { CLIENT_STATE_SCHEMA } from "./client-control"

export type ClientModelDefault = {
  readonly chain: readonly {
    readonly providers: readonly string[]
    readonly model: string
    readonly variant?: string
  }[]
  readonly resolved?: {
    readonly model: string
    readonly variant?: string
  }
}

function defaultsOf(
  requirements: Readonly<Record<string, ModelRequirement>>,
  constraints: PipelineModelResolutionRequest["constraints"],
): Record<string, ClientModelDefault> {
  return Object.fromEntries(Object.entries(requirements).map(([name, requirement]) => {
    const chain = requirement.fallbackChain.map(({ providers, model, variant }) => ({
      providers: [...providers],
      model,
      ...(variant !== undefined ? { variant } : {}),
    }))
    const resolved = constraints.connectedProviders === null
      ? undefined
      : resolveModelPipeline({ constraints, policy: { fallbackChain: chain } })
    return [name, {
      chain,
      ...(resolved ? {
        resolved: {
          model: resolved.model,
          ...(resolved.variant !== undefined ? { variant: resolved.variant } : {}),
        },
      } : {}),
    }]
  }))
}

/** Built-in defaults only; user config and UI selections never enter this document. */
export function buildClientModelDefaults(availableModels: Set<string>, connectedProviders: string[] | null) {
  const constraints = { availableModels, connectedProviders }
  return {
    schema: CLIENT_STATE_SCHEMA,
    agents: defaultsOf(AGENT_MODEL_REQUIREMENTS, constraints),
    categories: defaultsOf(CATEGORY_MODEL_REQUIREMENTS, constraints),
  }
}
