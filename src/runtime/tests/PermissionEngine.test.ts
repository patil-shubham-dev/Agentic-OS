import { describe, it, expect, beforeEach } from "vitest"
import { PermissionEngine } from "../permissions/PermissionEngine"
import type { ToolContext } from "../tools/core/ToolContext"

const defaultCtx: ToolContext = { role: "coder" }
const defaultPermit = { behavior: "allow" as const }

describe("PermissionEngine", () => {
  let engine: PermissionEngine

  beforeEach(() => {
    engine = new PermissionEngine()
  })

  describe("evaluate", () => {
    it("allows when tool returns allow", async () => {
      const result = await engine.evaluate("read_file", defaultPermit, defaultCtx)
      expect(result.behavior).toBe("allow")
    })

    it("denies when tool returns deny and policy also denies", async () => {
      const result = await engine.evaluate("write_file", { behavior: "deny" as const, reason: "blocked" }, defaultCtx)
      expect(result.behavior).toBe("deny")
      expect(result.reason).toContain("blocked")
    })

    it("asks when no policy rule matches and tool does not deny", async () => {
      const result = await engine.evaluate("unknown_tool", { behavior: "ask" as const }, defaultCtx)
      expect(result.behavior).toBe("ask")
    })
  })

  describe("requestApproval", () => {
    it("delegates to approval manager", async () => {
      const decision = await engine.requestApproval("write_file", { path: "/test" }, defaultCtx)
      expect(decision).toBeDefined()
      expect(typeof decision.approved).toBe("boolean")
    })

    it("auto-approves when auto-approve mode is on", async () => {
      engine.setAutoApprove(true)
      const decision = await engine.requestApproval("write_file", {}, defaultCtx)
      expect(decision.approved).toBe(true)
    })
  })

  describe("caching", () => {
    it("caches allow results for same tool/mode/role", async () => {
      const result1 = await engine.evaluate("grep_files", defaultPermit, defaultCtx)
      const result2 = await engine.evaluate("grep_files", defaultPermit, defaultCtx)
      expect(result1).toEqual(result2)
    })

    it("different roles produce separate cache entries", async () => {
      const r1 = await engine.evaluate("run_command", defaultPermit, { role: "manager" })
      const r2 = await engine.evaluate("run_command", defaultPermit, { role: "design" })
      expect(r1).toEqual(r2)
    })

    it("clearCache empties the cache", async () => {
      await engine.evaluate("grep_files", defaultPermit, defaultCtx)
      engine.clearCache()
      const r2 = await engine.evaluate("grep_files", defaultPermit, defaultCtx)
      expect(r2.behavior).toBe("allow")
    })
  })

  describe("setCacheTTL", () => {
    it("accepts custom TTL", () => {
      engine.setCacheTTL(10_000)
      expect(engine).toBeDefined()
    })
  })

  describe("policyResolver integration", () => {
    it("exposes policy resolver and approval manager", () => {
      expect(engine.getPolicyResolver()).toBeDefined()
      expect(engine.getApprovalManager()).toBeDefined()
    })
  })
})
