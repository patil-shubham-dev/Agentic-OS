import { getRuntimeConfig } from "@/runtime/config/runtime-mode"

const LOG_PREFIX = "[PerformanceBudget]"

const BUDGETS = {
  maxRenderPerSecond: 30,
  maxSubscriptionsPerPanel: 10,
  maxTimersPerPanel: 5,
  maxEventBurstPerSecond: 500,
  maxMemoryGrowthPerMinute: 50 * 1024 * 1024,
  maxMutationRatePerSecond: 20,
}

type BudgetName = keyof typeof BUDGETS

const windowCounts = new Map<string, { count: number; windowStart: number }>()

function checkWindow(name: string, maxPerSecond: number): boolean {
  const now = performance.now()
  let entry = windowCounts.get(name)
  if (!entry || now - entry.windowStart > 1000) {
    entry = { count: 0, windowStart: now }
    windowCounts.set(name, entry)
  }
  entry.count++
  return entry.count > maxPerSecond
}

export function checkBudget(name: BudgetName): boolean {
  if (!getRuntimeConfig().performanceBudgets) return true

  const limit = BUDGETS[name]
  let violated = false

  switch (name) {
    case "maxRenderPerSecond":
      violated = checkWindow("render", limit)
      break
    case "maxSubscriptionsPerPanel":
      violated = checkWindow("subscriptions", limit)
      break
    case "maxTimersPerPanel":
      violated = checkWindow("timers", limit)
      break
    case "maxEventBurstPerSecond":
      violated = checkWindow("events", limit)
      break
    case "maxMutationRatePerSecond":
      violated = checkWindow("mutations", limit)
      break
    default:
      return true
  }

  if (violated) {
    console.warn(`${LOG_PREFIX} ${name} exceeded (limit=${limit}/s)`)
    return false
  }
  return true
}

export function getBudget(name: BudgetName): number {
  return BUDGETS[name]
}

export function getBudgets(): Record<BudgetName, number> {
  return { ...BUDGETS }
}
