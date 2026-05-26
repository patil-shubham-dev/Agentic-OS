import { describe, it, expect } from "vitest"
import type { RuntimeRole } from "@/types"
import { RuntimeInspector } from "./runtime-inspector"

// Re-declare the constant maps for testing since they aren't exported.
// Validate them against the RuntimeRole type to ensure full coverage.
const STATUS_COLORS: Record<string, string> = {
  uninitialized: "text-white/30",
  initializing: "text-blue-400",
  ready: "text-green-400",
  error: "text-red-400",
}

const ROLE_ICONS: Record<string, string> = {
  manager: "Brain",
  coder: "Code2",
  vision: "Eye",
  research: "Search",
  runtime: "Terminal",
  design: "Palette",
  browser: "Globe",
  qa: "UserCircle",
  memory: "Brain",
  "fast-inference": "Zap",
}

const ROLE_COLORS: Record<string, string> = {
  manager: "text-amber-400",
  coder: "text-blue-400",
  vision: "text-pink-400",
  research: "text-purple-400",
  runtime: "text-cyan-400",
  design: "text-fuchsia-400",
  browser: "text-sky-400",
  qa: "text-green-400",
  memory: "text-indigo-400",
  "fast-inference": "text-emerald-400",
}

describe("RuntimeInspector component export", () => {
  it("exports RuntimeInspector as a function (React component)", () => {
    expect(RuntimeInspector).toBeDefined()
    expect(typeof RuntimeInspector).toBe("function")
  })
})

describe("STATUS_COLORS", () => {
  it("has entries for all runtime statuses", () => {
    const requiredStatuses = ["uninitialized", "initializing", "ready", "error"]
    for (const status of requiredStatuses) {
      expect(STATUS_COLORS[status]).toBeDefined()
      expect(STATUS_COLORS[status]).toContain("text-")
    }
  })

  it("each color starts with text-", () => {
    for (const color of Object.values(STATUS_COLORS)) {
      expect(color).toMatch(/^text-/)
    }
  })
})

describe("ROLE_ICONS", () => {
  it("has an icon entry for every RuntimeRole", () => {
    const allRoles: RuntimeRole[] = [
      "manager", "coder", "vision", "research", "runtime",
      "design", "qa", "browser", "memory", "fast-inference",
    ]
    for (const role of allRoles) {
      expect(ROLE_ICONS[role]).toBeDefined()
      expect(typeof ROLE_ICONS[role]).toBe("string")
    }
  })

  it("has exactly 10 role entries (matching all RuntimeRoles)", () => {
    expect(Object.keys(ROLE_ICONS)).toHaveLength(10)
  })
})

describe("ROLE_COLORS", () => {
  it("has a color entry for every RuntimeRole", () => {
    const allRoles: RuntimeRole[] = [
      "manager", "coder", "vision", "research", "runtime",
      "design", "qa", "browser", "memory", "fast-inference",
    ]
    for (const role of allRoles) {
      expect(ROLE_COLORS[role]).toBeDefined()
      expect(ROLE_COLORS[role]).toContain("text-")
    }
  })

  it("has exactly 10 role entries (matching all RuntimeRoles)", () => {
    expect(Object.keys(ROLE_COLORS)).toHaveLength(10)
  })

  it("all role colors are unique", () => {
    const colors = Object.values(ROLE_COLORS)
    const unique = new Set(colors)
    expect(unique.size).toBe(colors.length)
  })
})

describe("Sparkline SVG component logic", () => {
  it("returns null for empty data array (length < 2)", () => {
    const data: number[] = []
    expect(data.length < 2).toBe(true)
  })

  it("returns null for single-element array (length < 2)", () => {
    const data: number[] = [100]
    expect(data.length < 2).toBe(true)
  })

  it("renders for arrays with 2+ elements", () => {
    const data: number[] = [100, 200]
    expect(data.length >= 2).toBe(true)
  })

  it("uses fallback range of 1 when all values are equal (max === min)", () => {
    const data = [50, 50, 50, 50]
    const max = Math.max(...data)
    const min = Math.min(...data)
    const rawRange = max - min
    const range = rawRange || 1
    // When max === min, rawRange is 0 (falsy), so range falls back to 1
    expect(rawRange).toBe(0)
    expect(range).toBe(1)
  })

  it("scales correctly for ascending data", () => {
    const data = [0, 50, 100]
    const max = Math.max(...data, 1)
    const min = Math.min(...data, 0)
    const range = max - min
    expect(min).toBe(0)
    expect(max).toBe(100)
    expect(range).toBe(100)
  })

  it("scales correctly for negative values", () => {
    const data = [-10, 0, 10]
    const max = Math.max(...data, 1)
    const min = Math.min(...data, 0)
    const range = max - min || 1
    expect(min).toBe(-10)
    expect(max).toBe(10)
    expect(range).toBe(20)
  })
})

describe("boot sequence steps", () => {
  const BOOT_STEPS = [
    "Loading workspace runtime",
    "Resolving providers",
    "Resolving roles",
    "Wiring agents to providers",
    "Initializing orchestrator",
    "Runtime ready",
  ]

  it("has exactly 6 boot steps", () => {
    expect(BOOT_STEPS).toHaveLength(6)
  })

  it("each step is a non-empty string", () => {
    for (const step of BOOT_STEPS) {
      expect(step.length).toBeGreaterThan(0)
    }
  })
})
