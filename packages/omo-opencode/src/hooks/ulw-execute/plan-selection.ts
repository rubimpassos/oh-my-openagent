import { readdirSync, realpathSync, statSync } from "node:fs"
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path"
import { getPlanName, getPlanProgress } from "../../features/boulder-state"

function normalizePlanLookupValue(value: string): string {
  return value
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function findPlanByName(plans: readonly string[], requestedName: string): string | null {
  if (isPlanPathRequest(requestedName)) return null
  const lowerName = requestedName.toLowerCase()
  const normalizedRequestedName = normalizePlanLookupValue(requestedName)
  const exactMatch = plans.find((planPath) => getPlanName(planPath).toLowerCase() === lowerName)
  if (exactMatch) return exactMatch

  const normalizedExactMatch = plans.find(
    (planPath) => normalizePlanLookupValue(getPlanName(planPath)) === normalizedRequestedName,
  )
  if (normalizedExactMatch) return normalizedExactMatch

  const partialMatch = plans.find((planPath) => getPlanName(planPath).toLowerCase().includes(lowerName))
  if (partialMatch) return partialMatch

  return (
    plans.find((planPath) =>
      normalizePlanLookupValue(getPlanName(planPath)).includes(normalizedRequestedName),
    ) ?? null
  )
}

export function isPlanPathRequest(request: string): boolean {
  return /[/\\]/.test(request)
}

export function resolveExactPlanPath(directory: string, request: string): string | null {
  if (!/^(?:\.\/)?\.(?:omo|sisyphus)\/plans\/[^/\\\0]+\.md$/.test(request)) return null
  const segments = request.replace(/^\.\//, "").split("/")
  try {
    let current = resolve(directory)
    for (const segment of segments) {
      if (!readdirSync(current).includes(segment)) return null
      current = join(current, segment)
    }
    if (!statSync(current).isFile()) return null
    const realDirectory = realpathSync(directory)
    const realPlanDirectory = realpathSync(dirname(current))
    for (const [root, target] of [[realDirectory, realPlanDirectory], [realPlanDirectory, realpathSync(current)]]) {
      const descendant = relative(root, target)
      if (isAbsolute(descendant) || descendant === ".." || descendant.startsWith(`..${sep}`)) return null
    }
    return current
  } catch (error) {
    if (error instanceof Error && "code" in error) return null
    throw error
  }
}

export function pickPreferredIncompletePlan(
  incompletePlans: readonly string[],
  preferredPlanPath: string | null,
): string | null {
  if (!preferredPlanPath) {
    return null
  }

  return incompletePlans.find((planPath) => planPath === preferredPlanPath) ?? null
}

export function formatIncompletePlanList(
  plans: readonly string[],
  includeModifiedTime: boolean,
): string {
  return plans
    .map((planPath, index) => {
      const progress = getPlanProgress(planPath)
      const modified = includeModifiedTime
        ? ` - Modified: ${new Date(statSync(planPath).mtimeMs).toISOString()}`
        : ""

      return `${index + 1}. [${getPlanName(planPath)}]${modified} - Progress: ${progress.completed}/${progress.total}`
    })
    .join("\n")
}

export function buildMissingPlanContext(explicitPlanName: string, allPlans: readonly string[]): string {
  const incompletePlans = allPlans.filter((planPath) => !getPlanProgress(planPath).isComplete)
  if (incompletePlans.length > 0) {
    return `
## Plan Not Found

Could not find a plan matching "${explicitPlanName}".

Available incomplete plans:
${formatIncompletePlanList(incompletePlans, false)}

Ask the user which plan to work on.`
  }

  return `
## Plan Not Found

 Could not find a plan matching "${explicitPlanName}".
 No incomplete plans available. Create a new plan using the Prometheus agent.`
}
