import { resolve } from "node:path"
import {
  findPrometheusPlans,
  getBoulderWorks,
  getPlanName,
  getPlanProgress,
  getWorkByPlanName,
  readBoulderState,
  resolveBoulderPlanPathForWork,
  selectActiveWork,
} from "../../features/boulder-state"
import { log } from "../../shared/logger"
import { HOOK_NAME } from "./ulw-execute-hook"
import { buildAutoSelectedPlanContextInfoOnly, buildExistingSessionContext } from "./context-info-formatters"
import { buildMissingPlanContext, findPlanByName, isPlanPathRequest, resolveExactPlanPath } from "./plan-selection"
import { createNewWorkOrInitialize } from "./work-initializer"

export function buildExplicitPlanContext(params: {
  readonly explicitPlanName: string
  readonly sessionId: string
  readonly timestamp: string
  readonly activeAgent: string
  readonly worktreePath: string | undefined
  readonly worktreeBlock: string
  readonly directory: string
}): string {
  const { explicitPlanName, sessionId, timestamp, activeAgent, worktreePath, worktreeBlock, directory } =
    params
  log(`[${HOOK_NAME}] Explicit plan name requested: ${explicitPlanName}`, { sessionID: sessionId })

  const pathRequested = isPlanPathRequest(explicitPlanName)
  const exactPlan = pathRequested ? resolveExactPlanPath(directory, explicitPlanName) : null
  const allPlans = findPrometheusPlans(directory)
  if (pathRequested && !exactPlan) return buildMissingPlanContext(explicitPlanName, allPlans)

  if (exactPlan && worktreePath !== undefined) {
    const worktreePlan = resolveBoulderPlanPathForWork(directory, {
      active_plan: exactPlan,
      worktree_path: worktreePath,
    })
    if (worktreePlan !== exactPlan) {
      return `
## Exact Plan Worktree Conflict

The requested plan ${exactPlan} resolves to a different file in worktree ${worktreePath}: ${worktreePlan}.
No work was selected or created. Retry without --worktree to execute the requested file, or run /ulw-execute from the intended worktree directory.`
    }
  }

  const state = pathRequested ? readBoulderState(directory) : null
  const matchedWork = pathRequested
    ? state && getBoulderWorks(state).find((work) =>
      resolve(directory, work.active_plan) === exactPlan
      && resolveBoulderPlanPathForWork(directory, work) === exactPlan
      && (worktreePath === undefined || work.worktree_path === worktreePath))
    : getWorkByPlanName(directory, explicitPlanName, { worktreePath })
  if (matchedWork) {
    const matchedWorkProgress = getPlanProgress(exactPlan ?? matchedWork.active_plan)
    if (matchedWorkProgress.isComplete) {
      return buildPlanAlreadyCompleteContext({
        planName: matchedWork.plan_name,
        totalTasks: matchedWorkProgress.total,
      })
    }

    const selectedState = selectActiveWork(directory, matchedWork.work_id)
    if (selectedState) {
      return buildExistingSessionContext({
        existingState: selectedState,
        sessionId,
        activeAgent,
        worktreePath,
        worktreeBlock,
        directory,
      })
    }
  }

  const matchedPlan = exactPlan ?? findPlanByName(allPlans, explicitPlanName)
  if (!matchedPlan) {
    const incompletePlans = allPlans.filter((planPath) => !getPlanProgress(planPath).isComplete)
    if (!pathRequested && incompletePlans.length === 1) {
      createNewWorkOrInitialize({
        directory,
        planPath: incompletePlans[0],
        sessionId,
        activeAgent,
        worktreePath,
      })

      return buildAutoSelectedPlanContextInfoOnly({
        planPath: incompletePlans[0],
        sessionId,
        timestamp,
        worktreeBlock,
        reason: `Only incomplete plan available after "${explicitPlanName}" did not match any plan`,
      })
    }

    return buildMissingPlanContext(explicitPlanName, allPlans)
  }

  const progress = getPlanProgress(matchedPlan)
  if (progress.isComplete) {
    return buildPlanAlreadyCompleteContext({
      planName: getPlanName(matchedPlan),
      totalTasks: progress.total,
    })
  }

  createNewWorkOrInitialize({
    directory,
    planPath: matchedPlan,
    sessionId,
    activeAgent,
    worktreePath,
  })

  return buildAutoSelectedPlanContextInfoOnly({
    planPath: matchedPlan,
    sessionId,
    timestamp,
    worktreeBlock,
  })
}

function buildPlanAlreadyCompleteContext(params: {
  readonly planName: string
  readonly totalTasks: number
}): string {
  const { planName, totalTasks } = params

  return `
## Plan Already Complete

 The requested plan "${planName}" has been completed.
 All ${totalTasks} tasks are done. Create a new plan using the Prometheus agent.`
}
